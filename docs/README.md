# NaturaConverter Developer Documentation

NaturaConverter is a browser-based file converter built with TanStack Start and React. It
detects an uploaded file, finds a conversion path through a graph of format handlers, and runs
the selected handlers in the browser. Most heavy converters are JavaScript, WebAssembly, or
vendored browser libraries. The document bytes are not sent to the Nitro application server.

This directory contains the developer and operator guides for the repository.

## Documentation map

| Guide | Purpose |
| --- | --- |
| [ARCHITECTURE.md](./ARCHITECTURE.md) | Application layers, request flow, browser conversion flow, and build topology |
| [CONVERTER_ENGINE.md](./CONVERTER_ENGINE.md) | Engine API, format model, graph construction, path search, and failure handling |
| [HANDLERS.md](./HANDLERS.md) | Adding and fixing handlers, registration, browser runtimes, and static assets |
| [DEPLOYMENT.md](./DEPLOYMENT.md) | Docker, Compose, nginx, Certbot, Red Hat, clean releases, and cache policy |
| [TROUBLESHOOTING.md](./TROUBLESHOOTING.md) | Common development, conversion, asset, cache, and deployment failures |

## Technology stack

| Area | Repository implementation |
| --- | --- |
| Application framework | TanStack Start with file-based TanStack Router routes |
| UI | React 19, Tailwind CSS 4, Radix UI primitives, and shadcn-style components |
| Build | Vite 8 through `@lovable.dev/vite-tanstack-config` |
| Server output | Nitro `node-server` preset |
| Development package manager | Bun, with `bun.lock` as the Docker build lockfile |
| Production runtime | Node.js 22 Alpine |
| Conversion runtime | Browser JavaScript, workers, WebAssembly, Pyodide, and vendored libraries |
| Production proxy | nginx with Certbot-managed Let's Encrypt certificates |
| Containers | Docker multi-stage build and Docker Compose |

## Processing model

The Nitro server renders application routes and serves browser bundles and runtime assets. The
conversion itself starts after hydration and remains in the browser:

1. The `/` route accepts one `File` and calls `initEngine()` and `detectFormat()`.
2. PDF files may be edited on `/edit`. Other files continue to `/format`.
3. `/format` lists registered output formats and stores the selected target.
4. `/download` creates `ConvertPathNode` values and calls `convert()`.
5. The engine finds a handler path, runs each `doConvert()` step, and returns `Uint8Array`
   results.
6. The browser creates object URLs and downloads the output files.

Uploaded bytes live in the module-level store at `src/stores/file-store.ts`. A page reload clears
that in-memory state. `sessionStorage` receives only the uploaded file's name, size, and MIME
type.

## Prerequisites

### Local development

- [Bun](https://bun.sh/) compatible with the tracked `bun.lock`
- A current browser with WebAssembly and Web Worker support
- Enough browser memory for the input file and the selected converter runtime

### Container development and deployment

- Docker Engine
- Docker Compose v2, available as `docker compose`
- Ports 80 and 443 for the production nginx service
- DNS and a Let's Encrypt certificate for the domain configured in `nginx.conf`

## Quick start: local development

From the repository root:

```bash
bun install
bun run dev
```

Open the URL printed by Vite. The current local workflow uses port `8080` when the Lovable Vite
preset applies its normal development settings.

Before opening a change for review, run:

```bash
bun run typecheck
bun run lint
bun run test
bun run build
```

Some converters initialize large browser runtimes. The first visit to the format screen or the
first conversion can therefore take longer than later attempts.

## Quick start: local Docker image

Use the image directly for a local smoke test. This bypasses the production nginx and certificate
configuration:

```bash
docker build --build-arg BUILD_VERSION=local -t natura-converter:local .
docker run --rm -p 3000:3000 natura-converter:local
```

Open `http://localhost:3000`.

The image uses Bun only in the builder stage. The final stage runs
`.output/server/index.mjs` on Node.js 22 and serves `.output/public` from the same Nitro process.

For the production Compose stack, including nginx and Certbot, follow
[DEPLOYMENT.md](./DEPLOYMENT.md). The checked-in Compose setup does not publish the app service's
port to the host. It exposes port `6742` only to nginx inside the Compose network.

## Build output

```bash
bun run build
```

The `node-server` build produces:

```text
.output/
|- server/
|  `- index.mjs
`- public/
   |- assets/
   |- js/
   `- wasm/
```

`vite.config.ts` copies the workers and WASM files required by handlers. A custom Vite plugin also
copies the complete `pdf2docx-wasm` package to `.output/public/wasm/pdf2docx/`. The Dockerfile
repeats that package copy after the build so the production image contains the Pyodide runtime and
Python wheels.

## Commands

All commands run from the repository root.

| Command | Purpose |
| --- | --- |
| `bun run dev` | Start the Vite development server |
| `bun run build` | Create the production Nitro Node server bundle |
| `bun run build:dev` | Build with Vite's development mode |
| `bun run preview` | Start Vite's preview command |
| `bun run typecheck` | Run TypeScript with `--noEmit` |
| `bun run lint` | Run ESLint across the repository |
| `bun run format` | Rewrite supported files with Prettier |
| `bun run test` | Run the Vitest suite once |
| `bun run qa-engine.ts` | Run the standalone engine smoke script; see its browser and fixture limits in `qa-engine.ts` |

## Package manager policy

The repository tracks both `bun.lock` and `package-lock.json`, but the Dockerfile copies only
`package.json` and `bun.lock` before running `bun install`. Use Bun for normal dependency changes
and local checks so the environment matches the container build. See
[TROUBLESHOOTING.md](./TROUBLESHOOTING.md#bun-and-npm-produce-different-installs) if the two lockfiles
or `node_modules` drift.

## Important constraints

- `initEngine()` is browser-only and returns without initializing during SSR.
- Handler registration is intentionally fault-isolated. A constructor or initialization failure
  removes that handler from the current engine session instead of stopping every conversion.
- Browser memory sets the practical file-size limit. FFmpeg, ImageMagick, Pandoc, Typst, and
  Pyodide can add significant memory pressure.
- `pdf2docx-wasm` is AGPL-3.0 and loads about 50 MB of Pyodide files and Python wheels on first use.
  Review [the repository caveats](../DEPLOYMENT-CAVEATS.md) before a public deployment.
- A restrictive Content Security Policy can block the Pyodide runtime because it requires
  WebAssembly support and code paths that use `eval`.

## Where to make changes

| Change | Primary location |
| --- | --- |
| Page or route behavior | `src/routes/` |
| Shared UI | `src/components/` and `src/components/ui/` |
| File and format state | `src/stores/file-store.ts` |
| Conversion API and retries | `src/converter-engine/engine.ts` |
| Path selection and costs | `src/converter-engine/TraversionGraph.ts` |
| Shared format definitions | `src/converter-engine/CommonFormats.ts` |
| Add or fix a converter | `src/converter-engine/handlers/` |
| Register a converter | `src/converter-engine/handlers/index.ts` |
| Copy a browser runtime asset | `vite.config.ts` |
| Container image | `Dockerfile` |
| Production services | `docker-compose.yml` and `nginx.conf` |
