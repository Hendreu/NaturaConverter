import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useState, useCallback, useRef } from "react";
import {
  RotateCw,
  RotateCcw,
  ArrowRight,
  ArrowLeft,
  Trash2,
  ArrowUp,
  ArrowDown,
  GripVertical,
  FileWarning,
} from "lucide-react";
import { Breadcrumbs } from "@/components/breadcrumbs";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { getFile, getDetectedFormat, setEditedBytes, clearStore } from "@/stores/file-store";
import { initEngine, detectFormat } from "@/converter-engine/engine";
import { toast } from "sonner";
import { renderPdfThumbnails, type ThumbnailPage } from "@/lib/pdf-thumbnails";
import { applyEdits, type PageEditState } from "@/lib/pdf-edit";

export const Route = createFileRoute("/edit")({
  component: EditPage,
  head: () => ({
    meta: [{ title: "Editar arquivo — Natura Convert" }],
  }),
});

type Page = {
  thumbnail: ThumbnailPage;
  rotation: 0 | 90 | 180 | 270;
};

function EditPage() {
  const navigate = useNavigate();

  const [loading, setLoading] = useState(true);
  const [isPdf, setIsPdf] = useState(false);
  const [fileName, setFileName] = useState("");
  const [pages, setPages] = useState<Page[]>([]);
  const [dragIndex, setDragIndex] = useState<number | null>(null);
  const [dropIndex, setDropIndex] = useState<number | null>(null);
  const [applying, setApplying] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const bytesRef = useRef<ArrayBuffer | null>(null);

  useEffect(() => {
    const file = getFile();
    if (!file) {
      clearStore();
      navigate({ to: "/" });
      return;
    }

    setFileName(file.name);

    (async () => {
      try {
        await initEngine();
      } catch (err) {
        console.error("Failed to initialize conversion engine:", err);
        setError("Não foi possível inicializar o motor de conversão. Tente recarregar a página.");
        setLoading(false);
        return;
      }

      const detected = getDetectedFormat() ?? detectFormat(file);
      const pdfByType = file.type === "application/pdf";
      const pdfByDetect = detected?.format.format.toLowerCase() === "pdf";

      if (!pdfByType && !pdfByDetect) {
        setIsPdf(false);
        setLoading(false);
        return;
      }

      setIsPdf(true);

      try {
        const buf = await file.arrayBuffer();
        bytesRef.current = buf.slice(0);
        const thumbs = await renderPdfThumbnails(buf);
        setPages(thumbs.map((t) => ({ thumbnail: t, rotation: 0 })));
        setLoading(false);
      } catch (err) {
        console.error("Failed to render PDF thumbnails:", err);
        setError(err instanceof Error ? err.message : "Erro ao renderizar miniaturas do PDF.");
        setLoading(false);
      }
    })();
  }, [navigate]);

  const rotate = useCallback((index: number, dir: 1 | -1) => {
    setPages((prev) =>
      prev.map((p, i) =>
        i === index
          ? {
              ...p,
              rotation: ((((p.rotation + dir * 90) % 360) + 360) % 360) as 0 | 90 | 180 | 270,
            }
          : p,
      ),
    );
  }, []);

  const removePage = useCallback((index: number) => {
    setPages((prev) => prev.filter((_, i) => i !== index));
  }, []);

  const movePage = useCallback((from: number, to: number) => {
    setPages((prev) => {
      if (from === to || from < 0 || to < 0 || from >= prev.length || to >= prev.length)
        return prev;
      const next = [...prev];
      const [moved] = next.splice(from, 1);
      next.splice(to, 0, moved);
      return next;
    });
  }, []);

  const handleDragStart = (index: number) => {
    setDragIndex(index);
  };

  const handleDragOver = (e: React.DragEvent, index: number) => {
    e.preventDefault();
    setDropIndex(index);
  };

  const handleDrop = (e: React.DragEvent, index: number) => {
    e.preventDefault();
    if (dragIndex !== null && dragIndex !== index) {
      movePage(dragIndex, index);
    }
    setDragIndex(null);
    setDropIndex(null);
  };

  const handleDragEnd = () => {
    setDragIndex(null);
    setDropIndex(null);
  };

  const handleProceed = useCallback(async () => {
    if (!isPdf || !bytesRef.current) {
      navigate({ to: "/format" });
      return;
    }

    setApplying(true);
    try {
      const editStates: PageEditState[] = pages.map((p) => ({
        originalIndex: p.thumbnail.id - 1,
        rotation: p.rotation,
      }));
      const result = await applyEdits(bytesRef.current, editStates);
      setEditedBytes(result);
      navigate({ to: "/format" });
    } catch (err) {
      console.error("Failed to apply edits:", err);
      toast.error("Erro ao aplicar edições: " + (err instanceof Error ? err.message : String(err)));
      setApplying(false);
    }
  }, [isPdf, pages, navigate]);

  if (loading) {
    return (
      <>
        <Breadcrumbs
          items={[{ label: "Início", to: "/" }, { label: "Convert", to: "/" }, { label: "Editar" }]}
        />
        <section className="mx-auto max-w-6xl px-6 pb-10 pt-8">
          <div className="flex items-center justify-center py-32">
            <p className="font-display text-2xl text-muted-foreground">Carregando...</p>
          </div>
        </section>
      </>
    );
  }

  if (error) {
    return (
      <>
        <Breadcrumbs
          items={[{ label: "Início", to: "/" }, { label: "Convert", to: "/" }, { label: "Editar" }]}
        />
        <section className="mx-auto max-w-6xl px-6 pb-10 pt-8">
          <h1 className="font-display text-4xl font-medium md:text-5xl">
            Ajuste seu <em className="text-primary">arquivo</em>
          </h1>
          <Card className="mt-10 rounded-3xl border border-border bg-card p-10 text-center">
            <div className="mx-auto grid size-16 place-items-center rounded-full bg-cream">
              <FileWarning className="size-8 text-muted-foreground" />
            </div>
            <p className="mt-6 font-display text-2xl font-medium">{error}</p>
            <p className="mt-2 text-muted-foreground">
              Arquivo: <span className="font-medium text-foreground">{fileName}</span>
            </p>
            <Link
              to="/"
              className="mt-8 inline-flex items-center justify-center gap-2 rounded-full border border-border bg-card px-6 py-3 text-sm font-semibold text-foreground hover:border-foreground"
            >
              <ArrowLeft className="size-4" /> Voltar
            </Link>
          </Card>
        </section>
      </>
    );
  }

  if (!isPdf) {
    return (
      <>
        <Breadcrumbs
          items={[{ label: "Início", to: "/" }, { label: "Convert", to: "/" }, { label: "Editar" }]}
        />
        <section className="mx-auto max-w-6xl px-6 pb-10 pt-8">
          <h1 className="font-display text-4xl font-medium md:text-5xl">
            Ajuste seu <em className="text-primary">arquivo</em>
          </h1>
          <Card className="mt-10 rounded-3xl border border-border bg-card p-10 text-center">
            <div className="mx-auto grid size-16 place-items-center rounded-full bg-cream">
              <FileWarning className="size-8 text-muted-foreground" />
            </div>
            <p className="mt-6 font-display text-2xl font-medium">
              Edição não disponível para este formato
            </p>
            <p className="mt-2 text-muted-foreground">
              Arquivo: <span className="font-medium text-foreground">{fileName}</span>
            </p>
            <Button
              onClick={() => navigate({ to: "/format" })}
              className="mt-8 rounded-full bg-primary px-8 py-3 text-sm font-semibold text-primary-foreground shadow-lg shadow-primary/20 transition-transform hover:scale-[1.02]"
            >
              Escolher formato <ArrowRight className="size-4" />
            </Button>
          </Card>
        </section>
      </>
    );
  }

  return (
    <>
      <Breadcrumbs
        items={[{ label: "Início", to: "/" }, { label: "Convert", to: "/" }, { label: "Editar" }]}
      />

      <section className="mx-auto max-w-6xl px-6 pb-10 pt-8">
        <div className="flex flex-col gap-4 md:flex-row md:items-end md:justify-between">
          <div>
            <h1 className="font-display text-4xl font-medium md:text-5xl">
              Ajuste seu <em className="text-primary">arquivo</em>
            </h1>
            <p className="mt-2 text-muted-foreground">
              Rotacione, reordene e exclua páginas antes de converter.
            </p>
            <p className="mt-3 text-sm text-muted-foreground">
              Arquivo: <span className="font-medium text-foreground">{fileName}</span>
            </p>
          </div>
        </div>

        {pages.length === 0 ? (
          <Card className="mt-10 rounded-3xl border border-border bg-card p-10 text-center">
            <p className="font-display text-2xl font-medium text-muted-foreground">
              Nenhuma página — o documento ficará vazio
            </p>
          </Card>
        ) : (
          <div className="mt-10 grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
            {pages.map((page, index) => {
              const isDragging = dragIndex === index;
              const isDropTarget = dropIndex === index && dragIndex !== null && dragIndex !== index;
              return (
                <Card
                  key={page.thumbnail.id}
                  draggable
                  onDragStart={() => handleDragStart(index)}
                  onDragOver={(e) => handleDragOver(e, index)}
                  onDrop={(e) => handleDrop(e, index)}
                  onDragEnd={handleDragEnd}
                  aria-label="Reordenar"
                  className={[
                    "rounded-3xl border border-border bg-card p-5 transition-all",
                    isDragging ? "opacity-40" : "",
                    isDropTarget ? "border-primary ring-2 ring-primary/30" : "",
                    "hover:border-primary/40",
                  ].join(" ")}
                >
                  <div
                    className="relative grid place-items-center overflow-hidden rounded-2xl bg-cream p-4"
                    style={{ minHeight: "16rem" }}
                  >
                    <img
                      src={page.thumbnail.dataUrl}
                      alt={`Página ${page.thumbnail.id}`}
                      style={{
                        transform: `rotate(${page.rotation}deg)`,
                        maxWidth: "100%",
                        maxHeight: "15rem",
                      }}
                      className="transition-transform duration-300"
                      draggable={false}
                    />
                    <div className="absolute left-3 top-3 flex gap-2">
                      <Badge variant="secondary">Página {page.thumbnail.id}</Badge>
                      <Badge variant="secondary">{page.rotation}°</Badge>
                    </div>
                    <div className="absolute right-3 top-3 text-muted-foreground/50">
                      <GripVertical className="size-5" />
                    </div>
                  </div>

                  <div className="mt-4 flex items-center justify-between gap-2">
                    <div className="flex gap-1">
                      <Button
                        variant="outline"
                        size="icon"
                        aria-label="Girar à esquerda"
                        onClick={() => rotate(index, -1)}
                        className="rounded-full border-border hover:border-primary hover:text-primary"
                      >
                        <RotateCcw className="size-3.5" />
                      </Button>
                      <Button
                        variant="outline"
                        size="icon"
                        aria-label="Girar à direita"
                        onClick={() => rotate(index, 1)}
                        className="rounded-full border-border hover:border-primary hover:text-primary"
                      >
                        <RotateCw className="size-3.5" />
                      </Button>
                      <Button
                        variant="outline"
                        size="icon"
                        aria-label="Excluir"
                        onClick={() => removePage(index)}
                        className="rounded-full border-border hover:border-destructive hover:text-destructive"
                      >
                        <Trash2 className="size-3.5" />
                      </Button>
                    </div>
                    <div className="flex gap-1">
                      <Button
                        variant="outline"
                        size="icon"
                        aria-label="Mover para cima"
                        onClick={() => movePage(index, index - 1)}
                        disabled={index === 0}
                        className="rounded-full border-border hover:border-primary hover:text-primary"
                      >
                        <ArrowUp className="size-3.5" />
                      </Button>
                      <Button
                        variant="outline"
                        size="icon"
                        aria-label="Mover para baixo"
                        onClick={() => movePage(index, index + 1)}
                        disabled={index === pages.length - 1}
                        className="rounded-full border-border hover:border-primary hover:text-primary"
                      >
                        <ArrowDown className="size-3.5" />
                      </Button>
                    </div>
                  </div>
                </Card>
              );
            })}
          </div>
        )}

        <div className="mt-12 flex flex-col-reverse items-stretch justify-between gap-3 sm:flex-row sm:items-center">
          <Link
            to="/"
            className="inline-flex items-center justify-center gap-2 rounded-full border border-border bg-card px-6 py-3 text-sm font-semibold text-foreground hover:border-foreground"
          >
            <ArrowLeft className="size-4" /> Voltar
          </Link>
          <Button
            onClick={handleProceed}
            disabled={applying || !bytesRef.current}
            className="inline-flex items-center justify-center gap-2 rounded-full bg-primary px-8 py-3 text-sm font-semibold text-primary-foreground shadow-lg shadow-primary/20 transition-transform hover:scale-[1.02]"
          >
            {applying ? "Carregando..." : "Escolher formato"} <ArrowRight className="size-4" />
          </Button>
        </div>
      </section>
    </>
  );
}
