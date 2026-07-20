<!-- LOVABLE:BEGIN -->
> [!IMPORTANT]
> This project is connected to [Lovable](https://lovable.dev). Avoid rewriting
> published git history — force pushing, or rebasing/amending/squashing commits
> that are already pushed — as it rewrites history on Lovable's side and the
> user will likely lose their project history.
>
> Commits you push to the connected branch sync back to Lovable and show up in
> the editor, so keep the branch in a working state.
<!-- LOVABLE:END -->

# PROJECT KNOWLEDGE BASE

**Generated:** 2026-07-20
**Commit:** 6308f1b
**Branch:** main

## OVERVIEW
Natura Convert — single-package TanStack Start (React 19 + Vite 8 + Nitro/Cloudflare) browser app that converts between hundreds of file formats. The heavy lifting is done by vendored libraries and WASM modules wrapped in `src/converter-engine/handlers`.

## STRUCTURE
```
NaturaConverter/
├── src/
│   ├── components/        # app shell + shadcn/ui catalog
│   ├── components/ui/     # shadcn/ui primitives (40+)
│   ├── converter-engine/  # conversion graph + API
│   ├── converter-engine/handlers/  # vendored format handlers
│   ├── hooks/             # use-mobile
│   ├── lib/               # error, PDF, utils
│   ├── routes/            # TanStack file routes
│   └── stores/            # file-store
├── public/wasm + public/js # copied WASM/worker assets
├── vite.config.ts
├── qa-engine.ts           # standalone engine smoke test
└── package.json
```

## WHERE TO LOOK
| Task | Location |
|---|---|
| Add a file format | `src/converter-engine/handlers/` → add handler + register in `handlers/index.ts` |
| Change conversion routing | `src/converter-engine/engine.ts` + `TraversionGraph.ts` |
| UI page | `src/routes/{index,format,edit,download}.tsx` |
| SSR error handling | `src/server.ts` |
| shadcn component | `src/components/ui/` |
| PDF edit/thumbnails | `src/lib/pdf-{edit,thumbnails}.ts` |
| Build asset copies | `vite.config.ts` `viteStaticCopy` targets |
| QA smoke test | `qa-engine.ts` |

## CODE MAP
| Symbol | Type | Location | Refs | Role |
|---|---|---|---|---|
| getServerEntry | fn | src/server.ts:12 | 1 | SSR wrapper |
| getRouter | fn | src/router.tsx:5 | 1 | Router factory |
| initEngine | fn | src/converter-engine/engine.ts:11 | 7 | Load all handlers |
| detectFormat | fn | src/converter-engine/engine.ts:49 | 3 | Match uploaded file |
| getOutputFormats | fn | src/converter-engine/engine.ts:75 | 3 | List target formats |
| convert | fn | src/converter-engine/engine.ts:149 | 3 | Run conversion path |
| FormatHandler | interface | src/converter-engine/FormatHandler.ts:160 | 92 | Handler contract |
| CommonFormats | class | src/converter-engine/CommonFormats.ts:23 | 75 | Shared format defs |
| TraversionGraph | class | src/converter-engine/TraversionGraph.ts:46 | 3 | Path finder |
| registerHandlers | fn | src/converter-engine/handlers/index.ts:81 | 1 | Handler registry |

## CONVENTIONS
- Bun primary (`bun.lock`), but `package-lock.json` also tracked.
- TypeScript strict, ES2022, `jsx: react-jsx`, `moduleResolution: Bundler`.
- `@/*` path alias to `./src/*`; `qoi-fu`/`qoa-fu` aliases point to transpiled JS.
- Prettier: width 100, double quotes, trailing commas all.
- ESLint flat config; `server-only` import is banned (use `*.server.ts` or `@tanstack/react-start/server-only`).

## ANTI-PATTERNS (THIS PROJECT)
- Do not add TanStack/Tailwind/Nitro plugins to `vite.config.ts` — Lovable preset already provides them.
- Do not import `server-only` from Next.js.
- Do not force-push / rebase / amend / squash pushed commits (Lovable sync).
- Do not typecheck the excluded handler dirs directly; they are surfaced via JS or path aliases.

## UNIQUE STYLES
- `FormatHandler` contract: `init` → `doConvert`; `supportedFormats` built via `FormatDefinition.builder(...)`.
- `registerHandlers` wraps every push in `try/catch` so a broken handler doesn't crash the engine.
- Vendored handler subdirs are full git checkouts with their own `package.json` / `.github` / tests.
- `viteStaticCopy` copies ~16 WASM/worker assets at build time.

## COMMANDS
```bash
bun run dev          # vite dev
bun run build        # vite build (Cloudflare/Nitro target)
bun run build:dev    # vite build --mode development
bun run preview
bun run lint         # eslint .
bun run format       # prettier --write .
bun run typecheck    # tsc --noEmit
bun run qa-engine.ts # standalone engine smoke test
```

## NOTES
- No root CI/tests. Only `src/converter-engine/handlers/terraria-wld-parser/` has vitest tests.
- `src/server.ts` overrides the default TanStack SSR entry.
- `tsconfig.json` excludes `qoi-fu`, `qoa-fu`, `sppd`, `espeakng.js`, `terraria-wld-parser`, and parts of `image-to-txt`.
- `canvas` is externalized in both CJS and Rolldown builds.
