import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useCallback, useEffect, useState } from "react";
import {
  AlertCircle,
  ArrowLeft,
  CheckCircle2,
  Download,
  Loader2,
  RefreshCw,
} from "lucide-react";
import { Breadcrumbs } from "@/components/breadcrumbs";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import {
  clearStore,
  getDetectedFormat,
  getEditedBytes,
  getFile,
  getOutputFormat,
} from "@/stores/file-store";
import { convert, initEngine } from "@/converter-engine/engine";
import { ConvertPathNode, type FileData } from "@/converter-engine/FormatHandler";

export const Route = createFileRoute("/download")({
  component: DownloadPage,
  head: () => ({
    meta: [{ title: "Download — Natura Convert" }],
  }),
});

type Status = "converting" | "success" | "error";

function DownloadPage() {
  const navigate = useNavigate();
  const [status, setStatus] = useState<Status>("converting");
  const [outputFiles, setOutputFiles] = useState<FileData[]>([]);
  const [errorMsg, setErrorMsg] = useState("");

  const runConversion = useCallback(async () => {
    const file = getFile();
    const outputFormat = getOutputFormat();
    const detectedFormat = getDetectedFormat();

    if (!file || !outputFormat || !detectedFormat) {
      navigate({ to: "/" });
      return;
    }

    setStatus("converting");
    setErrorMsg("");

    try {
      await initEngine();

      const edited = getEditedBytes();
      const bytes = edited ?? new Uint8Array(await file.arrayBuffer());
      const fileData: FileData = { name: file.name, bytes };

      // Same format — skip conversion, download original directly
      if (
        detectedFormat.format.mime === outputFormat.mime &&
        detectedFormat.format.extension === outputFormat.extension
      ) {
        setOutputFiles([fileData]);
        setStatus("success");
        return;
      }

      const fromNode = new ConvertPathNode(
        detectedFormat.handler,
        detectedFormat.format,
      );
      // handler will be resolved by the engine via path search (simpleMode=true)
      const toNode = new ConvertPathNode(
        detectedFormat.handler,
        outputFormat,
      );

      const timeout = new Promise<never>((_, reject) =>
        setTimeout(
          () =>
            reject(new Error("A conversão está demorando muito (120s)")),
          120_000,
        ),
      );

      const result = await Promise.race([
        convert([fileData], fromNode, toNode),
        timeout,
      ]);

      if (!result) {
        setErrorMsg(
          "Nenhum caminho de conversão encontrado para este formato.",
        );
        setStatus("error");
        return;
      }

      setOutputFiles(result.files);
      setStatus("success");
    } catch (err) {
      setErrorMsg(err instanceof Error ? err.message : "Erro desconhecido");
      setStatus("error");
    }
  }, [navigate]);

  useEffect(() => {
    runConversion();
  }, [runConversion]);

  function downloadOne(file: FileData) {
    const mime = getOutputFormat()?.mime ?? "application/octet-stream";
    const blob = new Blob([new Uint8Array(file.bytes)], { type: mime });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = file.name;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  }

  function downloadAll(files: FileData[]) {
    files.forEach((f, i) => {
      setTimeout(() => downloadOne(f), i * 200);
    });
  }

  const breadcrumbs = (
    <Breadcrumbs
      items={[
        { label: "Início", to: "/" },
        { label: "Convert", to: "/" },
        { label: "Editar", to: "/edit" },
        { label: "Formato", to: "/format" },
        { label: "Download" },
      ]}
    />
  );

  if (status === "converting") {
    return (
      <>
        {breadcrumbs}
        <section className="mx-auto grid max-w-3xl place-items-center px-6 py-24 text-center">
          <Card className="flex flex-col items-center gap-6 rounded-3xl border border-border bg-card p-12 shadow-lg">
            <span className="grid size-20 place-items-center rounded-full bg-primary-soft text-primary">
              <Loader2 className="size-10 animate-spin" strokeWidth={1.6} />
            </span>
            <div>
              <h1 className="font-display text-3xl font-medium md:text-4xl">
                Convertendo...
              </h1>
              <p className="mt-3 text-muted-foreground">
                Isso pode levar alguns segundos...
              </p>
            </div>
          </Card>
        </section>
      </>
    );
  }

  if (status === "error") {
    return (
      <>
        {breadcrumbs}
        <section className="mx-auto grid max-w-3xl place-items-center px-6 py-24 text-center">
          <Card className="flex flex-col items-center gap-6 rounded-3xl border border-border bg-card p-12 shadow-lg">
            <span className="grid size-20 place-items-center rounded-full bg-destructive/10 text-destructive">
              <AlertCircle className="size-10" strokeWidth={1.6} />
            </span>
            <h1 className="font-display text-3xl font-medium md:text-4xl">
              Falha na conversão
            </h1>
            <div className="rounded-xl bg-destructive/10 px-6 py-4 text-sm text-destructive">
              {errorMsg}
            </div>
            <div className="flex flex-col-reverse items-stretch gap-3 sm:flex-row sm:items-center">
              <Button
                variant="outline"
                onClick={() => navigate({ to: "/format" })}
                className="rounded-full border-border px-6 py-3 text-sm font-semibold hover:border-foreground"
              >
                <ArrowLeft className="size-4" /> Voltar
              </Button>
              <Button
                onClick={runConversion}
                className="rounded-full bg-primary px-8 py-3 text-sm font-semibold text-primary-foreground shadow-lg shadow-primary/20 transition-transform hover:scale-[1.02] hover:bg-primary/90"
              >
                <RefreshCw className="size-4" /> Tentar novamente
              </Button>
            </div>
          </Card>
        </section>
      </>
    );
  }

  // Success
  return (
    <>
      {breadcrumbs}
      <section className="mx-auto grid max-w-3xl place-items-center px-6 py-24 text-center">
        <Card className="flex flex-col items-center gap-6 rounded-3xl border border-border bg-card p-12 shadow-lg">
          <span className="grid size-20 place-items-center rounded-full bg-forest/10 text-forest">
            <CheckCircle2 className="size-10" strokeWidth={1.6} />
          </span>
          <h1 className="font-display text-3xl font-medium md:text-4xl">
            Pronto!
          </h1>

          {outputFiles.length === 1 ? (
            <Button
              onClick={() => downloadOne(outputFiles[0])}
              className="rounded-full bg-primary px-8 py-3 text-sm font-semibold text-primary-foreground shadow-lg shadow-primary/20 transition-transform hover:scale-[1.02] hover:bg-primary/90"
            >
              <Download className="size-4" /> Baixar arquivo
            </Button>
          ) : (
            <div className="flex w-full flex-col gap-3">
              {outputFiles.map((f, i) => (
                <Button
                  key={i}
                  variant="outline"
                  onClick={() => downloadOne(f)}
                  className="rounded-full border-border px-6 py-3 text-sm font-semibold hover:border-primary hover:text-primary"
                >
                  <Download className="size-4" /> {f.name}
                </Button>
              ))}
              <Button
                onClick={() => downloadAll(outputFiles)}
                className="mt-2 rounded-full bg-primary px-8 py-3 text-sm font-semibold text-primary-foreground shadow-lg shadow-primary/20 transition-transform hover:scale-[1.02] hover:bg-primary/90"
              >
                <Download className="size-4" /> Baixar todos
              </Button>
            </div>
          )}

          <Link
            to="/"
            onClick={() => clearStore()}
            className="inline-flex items-center justify-center gap-2 rounded-full border border-border bg-card px-6 py-3 text-sm font-semibold text-foreground hover:border-foreground"
          >
            Converter outro arquivo
          </Link>
        </Card>
      </section>
    </>
  );
}