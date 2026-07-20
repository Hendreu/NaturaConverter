import { Link } from "@tanstack/react-router";

import naturaLogo from "@/img/natura-logo.png";

export function SiteHeader() {
  return (
    <header className="sticky top-0 z-40 border-b border-border/60 bg-background/80 backdrop-blur-md">
      <div className="mx-auto flex h-16 max-w-6xl items-center justify-between px-6">
        <Link to="/" className="flex items-center">
          <img
            src={naturaLogo}
            alt="Natura"
            className="h-8 w-auto"
          />
        </Link>

        <nav className="hidden items-center gap-8 text-sm font-medium text-muted-foreground md:flex">
          <Link to="/" className="transition-colors hover:text-foreground">
            Converter
          </Link>
          <a href="#ferramentas" className="transition-colors hover:text-foreground">
            Ferramentas
          </a>
          <a href="#sobre" className="transition-colors hover:text-foreground">
            Sobre
          </a>
        </nav>

        <Link
          to="/"
          className="inline-flex h-10 items-center rounded-full bg-foreground px-5 text-sm font-semibold text-background transition-transform hover:scale-[1.02]"
        >
          Começar agora
        </Link>
      </div>
    </header>
  );
}
