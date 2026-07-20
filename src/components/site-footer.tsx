export function SiteFooter() {
  return (
    <footer className="border-t border-border/60 bg-cream mt-24">
      <div className="mx-auto flex max-w-6xl flex-col items-start justify-between gap-6 px-6 py-10 md:flex-row md:items-center">
        <div className="flex items-center gap-2.5">
          <span
            aria-hidden
            className="grid size-7 place-items-center rounded-full bg-primary text-primary-foreground"
          >
            <span className="size-2 rounded-full bg-primary-foreground/90" />
          </span>
          <span className="font-display text-lg font-semibold">
            natura <span className="text-primary">convert</span>
          </span>
        </div>
        <p className="text-sm text-muted-foreground">
          © 2025 Natura &amp;Co —{" "}
          <span className="font-display italic text-forest">Bem Estar Bem</span>
        </p>
      </div>
    </footer>
  );
}
