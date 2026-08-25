# NaturaConverter

Conversor de arquivos em container Docker.

## Docker (Recomendado para servidores Red Hat)

```bash
# Build da imagem e subida do container
sudo docker compose up -d --build

# Ver os IPs e porta que o servidor está usando
sudo docker compose logs app
```

A saída mostra os endereços acessíveis, por exemplo:

```
🌐  http://10.224.1.244:6742
🌐  http://172.18.0.1:6742
```

Use o primeiro IP (rede real do host) para acessar de outras máquinas.

### Comandos úteis

| Ação | Comando |
|------|---------|
| Ver logs em tempo real | `sudo docker compose logs -f app` |
| Parar o servidor | `sudo docker compose down` |
| Subir sem rebuild | `sudo docker compose up -d` |

> **Nota:** Se seu usuário estiver no grupo `docker`, omita o `sudo`.

## Desenvolvimento local

Requer [Bun](https://bun.sh) instalado.

```bash
bun install
bun run dev        # vite dev — porta 8080
bun run build      # build de produção
bun run typecheck  # checagem de tipos
```
