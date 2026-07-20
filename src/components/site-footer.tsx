import naturaLogo from "@/img/natura-logo.png";

export function SiteFooter() {
  return (
    <footer className="border-t border-border/60 bg-cream mt-24">
      <div className="mx-auto flex max-w-6xl flex-col items-start justify-between gap-6 px-6 py-10 md:flex-row md:items-center">
        <img src={naturaLogo} alt="Natura" className="h-7 w-auto" />
        <p className="text-sm text-muted-foreground">
          © 2025 Natura &amp;Co —{" "}
          <span className="font-display italic text-forest">Bem Estar Bem</span>
        </p>
      </div>
    </footer>
  );
}
