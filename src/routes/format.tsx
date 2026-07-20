import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { ArrowLeft, ArrowRight, Search } from "lucide-react";
import { Breadcrumbs } from "@/components/breadcrumbs";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { getDetectedFormat, setOutputFormat } from "@/stores/file-store";
import { initEngine, getOutputFormats } from "@/converter-engine/engine";
import type { FileFormat } from "@/converter-engine/FormatHandler";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/format")({
  component: FormatPage,
  head: () => ({
    meta: [{ title: "Escolher formato — Natura Convert" }],
  }),
});

const CATEGORY_NAMES: Record<string, string> = {
  data: "Dados",
  image: "Imagens",
  video: "Vídeos",
  vector: "Vetores",
  document: "Documentos",
  text: "Texto",
  audio: "Áudio",
  archive: "Arquivos",
  spreadsheet: "Planilhas",
  presentation: "Apresentações",
  font: "Fontes",
  code: "Código",
  database: "Bancos de dados",
  model: "Modelos 3D",
};

// ponytail: hard-coded popularity list — replace with analytics when usage data exists
const COMMON_FORMATS = new Set([
  "pdf", "png", "jpeg", "jpg", "webp", "gif", "bmp", "tiff", "ico",
  "docx", "doc", "txt", "html", "md", "epub", "odt", "rtf", "tex",
  "xlsx", "xls", "csv", "ods", "tsv",
  "pptx", "ppt", "odp",
  "mp4", "mp3", "wav", "ogg", "flac", "aac", "mov", "avi", "mkv",
  "zip", "7z", "rar", "tar", "gz", "bz2",
  "json", "xml", "yaml", "yml", "toml", "ini",
  "svg", "ps", "eps",
]);

const NULL_FORMAT: FileFormat = {
  name: "",
  format: "__none__",
  extension: "",
  mime: "__none__",
  category: undefined,
  from: false,
  to: false,
  internal: "",
  lossless: false,
};

function normalizeCategory(category: FileFormat["category"]): string {
  if (!category) return "outros";
  if (Array.isArray(category)) return category[0] ?? "outros";
  return category;
}

function categoryLabel(cat: string): string {
  if (CATEGORY_NAMES[cat]) return CATEGORY_NAMES[cat];
  return cat.charAt(0).toUpperCase() + cat.slice(1);
}

function formatKey(fmt: FileFormat): string {
  return `${fmt.mime}-${fmt.format}`;
}

function formatScore(fmt: FileFormat): number {
  const ext = fmt.extension.replace(/^\./, "").toLowerCase();
  const name = fmt.format.toLowerCase();
  if (COMMON_FORMATS.has(ext)) return 2;
  if (COMMON_FORMATS.has(name)) return 1;
  return 0;
}

function FormatTile({
  fmt,
  active,
  onSelect,
}: {
  fmt: FileFormat;
  active: boolean;
  onSelect: (fmt: FileFormat) => void;
}) {
  return (
    <Card
      role="button"
      tabIndex={0}
      onClick={() => onSelect(fmt)}
      onKeyDown={(e) => {
        if (e.key === "Enter" || e.key === " ") {
          e.preventDefault();
          onSelect(fmt);
        }
      }}
      className={cn(
        "cursor-pointer rounded-lg border-border p-4 transition-all hover:border-primary",
        active && "ring-2 ring-primary bg-primary-soft",
      )}
    >
      <div className="flex items-start justify-between gap-2">
        <p className="font-medium leading-snug text-foreground">
          {fmt.name}
        </p>
        <Badge variant="secondary" className="shrink-0 uppercase">
          {fmt.extension.replace(/^\./, "").toUpperCase()}
        </Badge>
      </div>
      {fmt.lossless && (
        <Badge variant="outline" className="mt-2 text-forest">
          Lossless
        </Badge>
      )}
    </Card>
  );
}

function FormatPage() {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [allFormats, setAllFormats] = useState<FileFormat[]>([]);
  const [detected, setDetected] = useState(false);
  const [selected, setSelected] = useState<FileFormat | null>(null);
  const [query, setQuery] = useState("");

  useEffect(() => {
    let cancelled = false;
    initEngine().then(() => {
      if (cancelled) return;
      const detectedFormat = getDetectedFormat();
      const inputFormat = detectedFormat?.format ?? NULL_FORMAT;
      const outputs = getOutputFormats(inputFormat);

      if (cancelled) return;
      setAllFormats(outputs);
      setDetected(!!detectedFormat);
      setLoading(false);
    });
    return () => {
      cancelled = true;
    };
  }, []);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return allFormats;
    return allFormats.filter((fmt) => {
      const haystack = [
        fmt.name,
        fmt.format,
        fmt.extension,
        fmt.mime,
        categoryLabel(normalizeCategory(fmt.category)),
      ]
        .join(" ")
        .toLowerCase();
      return haystack.includes(q);
    });
  }, [allFormats, query]);

  const popular = useMemo(
    () => filtered.filter((fmt) => formatScore(fmt) > 0).sort((a, b) => formatScore(b) - formatScore(a)),
    [filtered],
  );

  const groups = useMemo(() => {
    const grouped = new Map<string, FileFormat[]>();
    for (const fmt of filtered) {
      const cat = normalizeCategory(fmt.category);
      const arr = grouped.get(cat) ?? [];
      arr.push(fmt);
      grouped.set(cat, arr);
    }
    return [...grouped.entries()]
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([category, formats]) => ({
        category,
        formats: formats.sort((a, b) => formatScore(b) - formatScore(a)),
      }));
  }, [filtered]);

  function handleConvert() {
    if (!selected) return;
    setOutputFormat(selected);
    navigate({ to: "/download" });
  }

  const breadcrumbs = [
    { label: "Início", to: "/" },
    { label: "Convert", to: "/" },
    { label: "Editar", to: "/edit" },
    { label: "Formato" },
  ];

  if (loading) {
    return (
      <>
        <Breadcrumbs items={breadcrumbs} />
        <section className="mx-auto max-w-6xl px-6 pb-10 pt-8">
          <p className="text-muted-foreground">Carregando formatos...</p>
        </section>
      </>
    );
  }

  if (allFormats.length === 0) {
    return (
      <>
        <Breadcrumbs items={breadcrumbs} />
        <section className="mx-auto max-w-6xl px-6 pb-10 pt-8">
          <div className="max-w-md">
            <h1 className="font-display text-3xl font-medium">
              Nenhum formato de saída disponível para este arquivo.
            </h1>
            <Button
              variant="outline"
              className="mt-6 rounded-full"
              onClick={() => navigate({ to: "/" })}
            >
              <ArrowLeft className="size-4" /> Voltar
            </Button>
          </div>
        </section>
      </>
    );
  }

  return (
    <>
      <Breadcrumbs items={breadcrumbs} />

      <section className="mx-auto max-w-6xl px-6 pb-10 pt-8">
        <div className="max-w-2xl">
          <h1 className="font-display text-4xl font-medium md:text-5xl">
            Escolha o <em className="text-primary">formato de saída</em>
          </h1>
          <p className="mt-3 text-muted-foreground">
            {detected
              ? "Selecione o formato desejado e conclua a conversão no navegador."
              : "Formato não identificado — escolha manualmente"}
          </p>
        </div>

        <div className="mt-8 max-w-xl">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              placeholder="Pesquisar conversão (ex: pdf, jpg, docx...)"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              className="rounded-full border-border bg-card pl-10 py-3 text-sm shadow-sm focus-visible:ring-primary"
            />
          </div>
        </div>

        {query.trim() === "" && popular.length > 0 && (
          <div className="mt-10">
            <h2 className="mb-5 font-display text-xl font-medium text-foreground">
              Mais populares
            </h2>
            <div className="grid gap-4 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4">
              {popular.slice(0, 8).map((fmt) => (
                <FormatTile
                  key={formatKey(fmt)}
                  fmt={fmt}
                  active={selected !== null && formatKey(selected) === formatKey(fmt)}
                  onSelect={setSelected}
                />
              ))}
            </div>
          </div>
        )}

        <div className="mt-10 space-y-12">
          {groups.map(({ category, formats }) => (
            <div key={category}>
              <h2 className="mb-5 font-display text-xl font-medium text-foreground">
                {categoryLabel(category)}
              </h2>
              <div className="grid gap-4 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4">
                {formats.map((fmt) => (
                  <FormatTile
                    key={formatKey(fmt)}
                    fmt={fmt}
                    active={selected !== null && formatKey(selected) === formatKey(fmt)}
                    onSelect={setSelected}
                  />
                ))}
              </div>
            </div>
          ))}
        </div>

        {query.trim() !== "" && filtered.length === 0 && (
          <div className="mt-10 text-center">
            <p className="text-muted-foreground">
              Nenhum formato encontrado para "{query}".
            </p>
          </div>
        )}

        <div className="mt-12 flex flex-col-reverse items-stretch justify-between gap-3 sm:flex-row sm:items-center">
          <Link
            to="/edit"
            className="inline-flex items-center justify-center gap-2 rounded-full border border-border bg-card px-6 py-3 text-sm font-semibold text-foreground hover:border-foreground"
          >
            <ArrowLeft className="size-4" /> Voltar
          </Link>
          <Button
            size="lg"
            className="rounded-full px-8 shadow-lg shadow-primary/20 transition-transform hover:scale-[1.02]"
            disabled={!selected}
            onClick={handleConvert}
          >
            Converter agora <ArrowRight className="size-4" />
          </Button>
        </div>
      </section>
    </>
  );
}
