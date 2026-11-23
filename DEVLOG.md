# NaturaConverter — Diário de Desenvolvimento

Sessão: 31/08/2026
Servidor: Red Hat, `convert.natura.com` (HTTPS via Nginx + Certbot)
Stack: TanStack Start + React 19 + Vite 8 + Nitro (preset `node-server`) + Bun dentro de Docker

## 1. Sintoma inicial

Após rodar `docker compose up -d --build` no servidor, o navegador em `https://convert.natura.com` continuava mostrando a interface antiga. Os logs do container mostravam o build novo rodando, a porta 6742 respondendo, mas a UI não atualizava.

## 2. Causas raiz

Identificadas em ordem de investigação:

1. **Mudanças locais não enviadas ao servidor.** Várias alterações estavam apenas no repositório local e nunca chegaram ao diretório servido pelo Docker no Red Hat.
2. **Diretório `NaturaConverter` duplicado no servidor.** O `compose` estava subindo a partir de um caminho antigo, enquanto o código novo estava em outro caminho. O build novo nunca tocava o que o Nginx servia.
3. **Cache de camadas do Docker.** Mesmo com `docker compose build`, a camada de `bun run build` reaproveitava artefatos antigos quando os arquivos de origem não tinham `mtime` mais recente.
4. **Cache do navegador e cache do Nginx.** O `index.html` era cacheado de forma agressiva, então o HTML antigo continuava apontando para os mesmos nomes de assets antigos (que não existiam mais ou tinham outro hash).
5. **Arquivos de runtime do `pdf2docx-wasm` ausentes no build de produção.** O plugin `viteStaticCopy` copia WASMs da lista declarada em `vite.config.ts`, mas o runtime do Pyodide + wheels do `pdf2docx-wasm` não estavam entre os alvos. Resultado: a conversão PDF → DOCX virava imagem rasterizada em vez de texto editável.

## 3. Arquivos alterados

### 3.1 `nginx.conf`

Dois blocos `server` (porta 80 redireciona para 443 e serve o desafio ACME; porta 6742 proxy para o app; porta 443 faz TLS). Dentro do bloco 443, cabeçalhos `Cache-Control` separados por rota:

- `~* ^/(assets|wasm|js|_build|__nitro)/` recebe `public, max-age=31536000, immutable`. Assets com hash podem ficar em cache por um ano.
- `/` recebe `no-cache, no-store, must-revalidate`. HTML e rotas SSR nunca são cacheadas.

`proxy_hide_header Cache-Control` sobrescreve qualquer cabeçalho que o Nitro envie.

### 3.2 `docker-compose.yml`

Adicionado `BUILD_VERSION` como argumento de build:

```yaml
build:
  context: .
  args:
    - BUILD_VERSION=${BUILD_VERSION:-}
```

### 3.3 `Dockerfile`

Dois ajustes no stage `builder`:

- Recebe `ARG BUILD_VERSION` e imprime o valor antes do `bun run build`. Quando a variável muda, o Docker invalida a camada e refaz tudo.
- Cópia explícita do runtime do `pdf2docx-wasm` para a pasta pública do Nitro:

```dockerfile
RUN mkdir -p .output/public/wasm/pdf2docx && cp -r node_modules/pdf2docx-wasm/* .output/public/wasm/pdf2docx/
```

### 3.4 `vite.config.ts`

- `viteStaticCopy` movido para o array `plugins` no nível superior (fora de `vite:`), com comentário `ponytail:` explicando que ele precisa rodar antes dos plugins internos do TanStack/Nitro.
- Adicionado plugin customizado `copyPdf2DocxWasm()` que faz o mesmo espelhamento no hook `writeBundle`, como defesa em profundidade caso o `viteStaticCopy` deixe de funcionar em alguma versão futura do Vite.

### 3.5 `src/components/site-header.tsx`

Texto do header encurtado para apenas `Natura`. Foi uma mudança temporária usada como teste de fumaça para confirmar que o HTML novo estava realmente sendo entregue ao navegador.

### 3.6 `readme.md`

Nova seção "Atualizando para uma nova versão" documenta o comando limpo de deploy e explica por que `BUILD_VERSION` existe. Inclui também a tabela de comandos úteis (logs, parar, subir, rebuild forçado).

## 4. Workflow de deploy

Comando canônico para subir uma nova versão com cache invalidado:

```bash
# Dentro do diretório correto do projeto no servidor
sudo docker compose down
BUILD_VERSION=$(git rev-parse HEAD) sudo docker compose up -d --build
```

Comandos úteis:

| Ação | Comando |
|------|---------|
| Logs em tempo real | `sudo docker compose logs -f app` |
| Parar o servidor | `sudo docker compose down` |
| Subir sem rebuild | `sudo docker compose up -d` |
| Forçar rebuild limpo | `BUILD_VERSION=$(git rev-parse HEAD) sudo docker compose up -d --build` |
| Reiniciar só o Nginx | `sudo docker compose restart nginx` |

Antes do deploy, conferir:

```bash
pwd                         # garante que está no diretório certo
git status                  # working tree limpo no servidor
git log --oneline -1        # commit esperado está no checkout
```

## 5. Problema PDF → DOCX

O handler `src/converter-engine/handlers/pdf2docx.ts` usa `pdf2docx-wasm`, que embute o Pyodide (~50 MB) mais as wheels Python necessárias para a extração de texto. O construtor recebe o caminho onde esses arquivos ficam servidos em produção:

```ts
this.converter = new Pdf2Docx("/wasm/pdf2docx/");
```

Sem esses arquivos em `.output/public/wasm/pdf2docx/`, o Pyodide não inicializa e a conversão cai num fallback. O `.docx` resultante vinha com imagens das páginas em vez de texto editável.

Correção em duas camadas:

1. `vite.config.ts` ganhou o plugin `copyPdf2DocxWasm()` que faz `fs.cpSync(node_modules/pdf2docx-wasm, .output/public/wasm/pdf2docx, { recursive: true, force: true, dereference: true })` no hook `writeBundle`. Garante a cópia em todo build de produção local ou no CI.
2. `Dockerfile` repete a mesma cópia com `cp -r` logo após o `bun run build`. Garante que o conteúdo sobreviva mesmo se o plugin Vite for alterado ou removido no futuro.

## 6. Como verificar que o fix funcionou

```bash
# 1. HTML nunca é cacheado: header deve trazer no-cache, no-store, must-revalidate
curl -I https://convert.natura.com/

# 2. Assets com hash podem ser cacheados por um ano
curl -I "https://convert.natura.com/assets/$(ls .output/public/assets/ | head -1)"

# 3. Runtime do pdf2docx está presente na origem servida
curl -I https://convert.natura.com/wasm/pdf2docx/

# 4. Texto do header é "Natura" (não a versão antiga)
curl -s https://convert.natura.com/ | grep -o "Natura"
```

Teste funcional da conversão PDF → DOCX no navegador: arrastar um PDF com texto selecionável, baixar o `.docx` resultante e abrir no Word ou LibreOffice. O texto precisa vir selecionável e editável, não como imagem embutida.

## 7. Lições aprendidas

- Build args sensíveis ao tempo (`BUILD_VERSION=$(git rev-parse HEAD)`) são a forma mais simples de forçar rebuild sem precisar de `--no-cache` completo. Vale o hábito de sempre passar uma variável assim em pipelines de imagem.
- Servir HTML sem cache e assets com hash em cache longo é o padrão para SPAs em Nginx. Misturar os dois é receita para `index.html` obsoleto que aponta para arquivos que mudaram de nome.
- `viteStaticCopy` precisa rodar cedo no grafo de plugins. Quando ele vive dentro de `vite:`, plugins do Nitro ou do TanStack podem sobrescrever `.output/public` depois e os assets somem.
- Handlers WASM com runtime externo (Pyodide, FFmpeg, ImageMagick) precisam de defesa em camadas: cópia no plugin Vite **e** no Dockerfile. Um só dos dois não basta.
- Sempre conferir `pwd` no servidor antes de buildar. Diretório errado é a causa mais boba e mais comum de "não subiu a atualização".
- Mudança visual simples (trocar o texto do header) é um teste de fumaça barato para diferenciar bug de deploy de bug de código.