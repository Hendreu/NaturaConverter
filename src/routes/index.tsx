import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useCallback, useRef, useState } from "react";
import { Upload, ShieldCheck, Zap, Layers, ArrowRight } from "lucide-react";
import { Breadcrumbs } from "@/components/breadcrumbs";
import { setFile, setDetectedFormat } from "@/stores/file-store";
import { initEngine, detectFormat } from "@/converter-engine/engine";

export const Route = createFileRoute("/")({
  component: Home,
});

function Home() {
  const navigate = useNavigate();
  const inputRef = useRef<HTMLInputElement>(null);
  const [dragging, setDragging] = useState(false);

  const handleFile = useCallback(
    async (file: File) => {
      if (typeof window !== "undefined") {
        sessionStorage.setItem(
          "natura-convert:file",
          JSON.stringify({ name: file.name, size: file.size, type: file.type }),
        );
      }
      setFile(file);
      try {
        await initEngine();
        const detected = detectFormat(file);
        setDetectedFormat(detected);
      } catch (err) {
        console.warn("Engine init/detect failed:", err);
      }
      navigate({ to: "/edit" });
    },
    [navigate],
  );

  const onDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setDragging(false);
    const file = e.dataTransfer.files?.[0];
    if (file) handleFile(file);
  };

  return (
    <>
      <Breadcrumbs
        items={[
          { label: "Início", to: "/" },
          { label: "Convert" },
          { label: "Conversor Universal" },
        ]}
      />

      {/* Hero + dropzone */}
      <section className="mx-auto max-w-6xl px-6 pb-16 pt-10">
        <div className="mx-auto max-w-3xl text-center">
          <span className="inline-flex items-center gap-2 rounded-full border border-border bg-cream px-3 py-1 text-xs font-medium uppercase tracking-widest text-forest">
            <span className="size-1.5 rounded-full bg-forest" />
            Bem Estar Bem
          </span>
          <h1 className="mt-6 font-display text-5xl font-medium leading-[1.05] text-foreground md:text-6xl">
            Conversor <em className="not-italic text-primary">Universal</em>
            <br /> de Arquivos
          </h1>
          <p className="mx-auto mt-5 max-w-xl text-lg text-muted-foreground">
            Arraste e solte um arquivo ou clique para selecionar. Converta entre
            centenas de formatos diretamente no navegador.
          </p>
        </div>

        <div className="relative mx-auto mt-12 max-w-3xl">
          <div
            aria-hidden
            className="absolute -inset-6 -z-10 rounded-[2.5rem] bg-primary-soft/60 blur-2xl"
          />
          <label
            onDragOver={(e) => {
              e.preventDefault();
              setDragging(true);
            }}
            onDragLeave={() => setDragging(false)}
            onDrop={onDrop}
            className={[
              "group relative flex cursor-pointer flex-col items-center justify-center rounded-[2rem] border-2 border-dashed bg-card px-6 py-20 text-center transition-all",
              dragging
                ? "border-primary bg-primary-soft/40 scale-[1.01]"
                : "border-border hover:border-primary/60 hover:bg-cream",
            ].join(" ")}
          >
            <input
              ref={inputRef}
              type="file"
              className="sr-only"
              onChange={(e) => {
                const f = e.target.files?.[0];
                if (f) handleFile(f);
              }}
            />
            <span className="grid size-20 place-items-center rounded-full bg-primary text-primary-foreground shadow-lg shadow-primary/25 transition-transform group-hover:scale-105">
              <Upload className="size-9" strokeWidth={1.8} />
            </span>
            <p className="mt-6 font-display text-2xl font-medium text-foreground">
              Arraste um arquivo aqui
            </p>
            <p className="mt-1.5 text-sm text-muted-foreground">
              ou clique para selecionar
            </p>
            <span className="mt-8 inline-flex items-center gap-2 rounded-full bg-foreground px-6 py-3 text-sm font-semibold text-background">
              Selecionar arquivo
              <ArrowRight className="size-4" />
            </span>
          </label>
        </div>
      </section>

      {/* How it works */}
      <section id="ferramentas" className="border-t border-border/60 bg-cream/60">
        <div className="mx-auto max-w-6xl px-6 py-20">
          <div className="mx-auto max-w-2xl text-center">
            <h2 className="font-display text-4xl font-medium">
              Como converter arquivos <em className="text-primary">online</em>
            </h2>
            <p className="mt-3 text-muted-foreground">Siga estas etapas simples:</p>
          </div>

          <ol className="mt-14 grid gap-8 md:grid-cols-3">
            {[
              "Arraste e solte seu arquivo na área designada ou clique para selecionar.",
              "Escolha o formato de saída desejado entre centenas de opções compatíveis.",
              "Clique em converter e baixe seu arquivo convertido instantaneamente.",
            ].map((text, i) => (
              <li
                key={i}
                className="relative rounded-3xl border border-border bg-card p-8"
              >
                <span className="absolute -top-5 left-8 grid size-11 place-items-center rounded-full bg-primary font-display text-lg font-semibold text-primary-foreground shadow-md shadow-primary/25">
                  {i + 1}
                </span>
                <p className="mt-4 text-base leading-relaxed text-foreground">
                  {text}
                </p>
              </li>
            ))}
          </ol>
        </div>
      </section>

      {/* Why */}
      <section id="sobre" className="mx-auto max-w-6xl px-6 py-24">
        <div className="mx-auto max-w-2xl text-center">
          <h2 className="font-display text-4xl font-medium">
            Por que escolher o{" "}
            <em className="not-italic text-primary">Natura Convert</em>
          </h2>
        </div>

        <div className="mt-14 grid gap-6 md:grid-cols-3">
          {[
            {
              icon: Layers,
              title: "Conversão universal",
              body: "Suporte a mais de 300 formatos de arquivo. Documentos, imagens, áudio, vídeo e muito mais.",
            },
            {
              icon: ShieldCheck,
              title: "Privacidade garantida",
              body: "Seus arquivos são processados localmente no navegador. Nada é enviado para servidores externos.",
            },
            {
              icon: Zap,
              title: "Rápido e gratuito",
              body: "Conversão instantânea sem limitações. Sem cadastro, sem watermark, sem complicação.",
            },
          ].map(({ icon: Icon, title, body }) => (
            <div
              key={title}
              className="rounded-3xl border border-border bg-card p-8 transition-colors hover:border-primary/40"
            >
              <span className="grid size-12 place-items-center rounded-2xl bg-primary-soft text-primary">
                <Icon className="size-6" strokeWidth={1.8} />
              </span>
              <h3 className="mt-6 font-display text-2xl font-medium">{title}</h3>
              <p className="mt-3 text-muted-foreground">{body}</p>
            </div>
          ))}
        </div>
      </section>

      {/* FAQ */}
      <section className="border-t border-border/60 bg-cream/60">
        <div className="mx-auto grid max-w-6xl gap-12 px-6 py-24 md:grid-cols-[1fr_1.4fr]">
          <div>
            <h2 className="font-display text-4xl font-medium leading-tight">
              Dúvidas? <br />
              <em className="text-primary">Nós temos as respostas.</em>
            </h2>
          </div>
          <div className="divide-y divide-border">
            {[
              {
                q: "Quais formatos de arquivo são suportados?",
                a: "O Natura Convert suporta mais de 300 formatos diferentes, incluindo documentos (PDF, DOCX, TXT), imagens (PNG, JPG, SVG, WEBP), áudio (MP3, WAV, FLAC), vídeo (MP4, WEBM, AVI), e muitos outros. A lista completa é atualizada constantemente.",
              },
              {
                q: "Meus documentos estão protegidos?",
                a: "Sim. Toda a conversão acontece localmente no seu dispositivo usando tecnologia WebAssembly. Seus arquivos nunca saem do seu computador — nenhum dado é enviado para servidores externos.",
              },
              {
                q: "Posso converter arquivos grandes?",
                a: "Sim, não há limite de tamanho explícito. A conversão é feita no seu navegador, então o limite prático depende da memória RAM do seu dispositivo. A maioria dos arquivos até algumas centenas de MB funciona perfeitamente.",
              },
              {
                q: "Preciso instalar algum programa?",
                a: "Não. O Natura Convert funciona 100% no navegador, sem necessidade de instalação. Basta acessar a página, selecionar o arquivo e escolher o formato de saída.",
              },
            ].map(({ q, a }) => (
              <details key={q} className="group py-5">
                <summary className="flex cursor-pointer list-none items-center justify-between gap-6 text-lg font-medium text-foreground">
                  {q}
                  <span className="grid size-8 flex-none place-items-center rounded-full border border-border text-primary transition-transform group-open:rotate-45">
                    +
                  </span>
                </summary>
                <p className="mt-3 pr-10 text-muted-foreground">{a}</p>
              </details>
            ))}
          </div>
        </div>
      </section>
    </>
  );
}
