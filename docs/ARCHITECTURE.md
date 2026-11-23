# NaturaConverter Architecture

## Scope

NaturaConverter is a single-package TanStack Start application with two distinct execution paths:

1. An HTTP path renders routes and serves browser assets through Nitro and nginx.
2. A browser path reads local files and runs the converter engine and handlers.

The application server does not expose a file-conversion API. Uploaded file bytes remain in the
browser unless a future feature adds an explicit upload.

## System context

```text
                         Production host

Browser  -- HTTPS -->  nginx :443  -- HTTP -->  Nitro app :6742
   |                       |                       |
   |                       |                       `- SSR route responses
   |                       `- TLS and cache headers   browser bundles
   |                                               WASM and worker assets
   |
   `- File API -> file-store -> converter engine -> handler graph -> download Blob
```

For a direct Docker image run, Nitro listens on its default port `3000`. The Compose service
overrides `PORT` to `6742`; nginx is the only service that publishes host ports.

## Main layers

| Layer | Main files | Responsibility |
| --- | --- | --- |
| HTTP proxy | `nginx.conf` | TLS termination, HTTP to HTTPS redirect, ACME challenge path, proxying, and cache headers |
| Server runtime | `src/server.ts`, Nitro output | SSR request handling, static files, and HTML fallback for catastrophic SSR errors |
| Routing | `src/router.tsx`, `src/routes/`, `src/routeTree.gen.ts` | File-based routes, route metadata, shell, navigation, and hydration |
| UI | `src/components/`, `src/components/ui/`, `src/styles.css` | Application shell and reusable React components |
| Workflow state | `src/stores/file-store.ts` | Current `File`, detected format, edited PDF bytes, and selected output format |
| PDF editing | `src/lib/pdf-edit.ts`, `src/lib/pdf-thumbnails.ts` | Browser PDF thumbnails, page rotation, ordering, removal, and rewritten bytes |
| Converter API | `src/converter-engine/engine.ts` | Handler initialization, detection, output enumeration, path attempts, and retries |
| Path search | `src/converter-engine/TraversionGraph.ts`, `PriorityQueue.ts` | Weighted graph construction and Dijkstra-style path search |
| Handler contract | `src/converter-engine/FormatHandler.ts`, `CommonFormats.ts` | Shared format model, data model, and handler interface |
| Converters | `src/converter-engine/handlers/` | JavaScript, WASM, worker, and vendored conversion wrappers |
| Build and assets | `vite.config.ts` | TanStack Start configuration, Nitro preset, dependency exclusions, and runtime asset copies |
| Containers | `Dockerfile`, `docker-compose.yml`, `docker-entrypoint.js` | Bun build stage, Node runtime stage, service wiring, and startup logging |

## HTTP request flow

### Development

`bun run dev` starts Vite through `@lovable.dev/vite-tanstack-config`. The preset already installs
the TanStack Start, React, Tailwind CSS, path alias, Nitro, and development tooling plugins.
`vite.config.ts` must not add duplicate instances of those plugins.

The development request flow is:

```text
Browser -> Vite development server -> TanStack Start route -> React response
```

Vite also serves source modules and handler runtime files during development.

### Production

The production request flow is:

```text
Browser
  -> nginx on port 443
  -> app service at http://app:6742
  -> .output/server/index.mjs
  -> src/server.ts wrapper
  -> @tanstack/react-start/server-entry
  -> matched file route
```

`src/server.ts` dynamically loads the standard TanStack server entry once and delegates each
request to it. The wrapper handles two failure forms:

- A thrown server error becomes an HTML error page with status 500.
- An h3 500 JSON body shaped as `{"unhandled":true,"message":"HTTPError"}` is replaced with the
  same HTML error page, because that error has already been converted to a response before the
  outer `try` block can catch it.

The root route in `src/routes/__root.tsx` supplies document metadata, styles, fonts, the site
header and footer, `QueryClientProvider`, route outlet, scripts, not-found UI, and the root React
error boundary. TanStack Router generates `src/routeTree.gen.ts` from the files in `src/routes/`.

## Browser conversion flow

### 1. Upload and detection

`src/routes/index.tsx` accepts the first selected or dropped file. Its `handleFile()` function:

1. Stores the `File` in `src/stores/file-store.ts`.
2. Stores only the file name, size, and MIME type in `sessionStorage`.
3. Awaits `initEngine()`.
4. Calls `detectFormat(file)` and stores the returned format and handler.
5. Navigates PDFs to `/edit` and other files to `/format`.

`initEngine()` immediately returns during SSR because it checks `typeof window === "undefined"`.
This keeps browser-only libraries out of the server execution path.

### 2. Optional PDF editing

`src/routes/edit.tsx` verifies that the file is a PDF by browser MIME type or engine detection. It
loads thumbnail pages, keeps page order and rotation in React state, and calls `applyEdits()` when
the user continues. The resulting `Uint8Array` is stored separately from the original `File`.

Non-PDF files skip editing and continue to `/format`.

### 3. Output selection

`src/routes/format.tsx` initializes the engine again, which is a no-op after successful
initialization, then calls `getOutputFormats()` for the detected input. Formats are grouped for
display by their first category. The selected `FileFormat` is stored before navigation to
`/download`.

`getOutputFormats()` returns every unique registered format with `to: true`, excluding an exact
input format match. It does not prove graph reachability at this stage. The path search performs
that check when conversion starts.

### 4. Conversion

`src/routes/download.tsx` reads the file, detected format, optional edited bytes, and output format
from the store. It then:

1. Uses edited bytes when present, otherwise reads the original `File` into a `Uint8Array`.
2. Returns the original bytes directly when MIME type and extension already match the target.
3. Creates input and output `ConvertPathNode` values.
4. Races `convert()` against a 120 second route-level timeout.
5. Stores one or more output `FileData` records in component state.

The engine asks `TraversionGraph` for paths in ascending weighted cost. Each edge invokes the
handler held by the next path node. If a handler throws or returns an empty file, the attempted path
prefix is marked as a temporary dead end and the engine tries another graph path. When no path
succeeds, `convert()` returns `null`.

### 5. Download

The route wraps each result in a browser `Blob`, creates an object URL, clicks a temporary anchor,
and revokes the URL one second later. Multiple results are downloaded 200 milliseconds apart.

## State and data ownership

`src/stores/file-store.ts` uses module-level variables, not persistent storage:

| Value | Type | Reset behavior |
| --- | --- | --- |
| Uploaded file | `File | null` | Cleared by `setFile()` replacement or `clearStore()` |
| Detection | `{ format: FileFormat; handler: FormatHandler } | null` | Cleared when a new file is set |
| Edited bytes | `Uint8Array | null` | Cleared when a new file is set |
| Output format | `FileFormat | null` | Cleared when a new file is set |

This simple store fits the single-file, single-tab workflow. Refreshing a workflow route loses the
file object, so routes redirect to `/` when required values are absent.

## Converter graph boundary

The converter engine turns handler declarations into a graph:

```text
FileFormat input node
  -> handler edge
  -> intermediate FileFormat node
  -> handler edge
  -> target FileFormat node
```

A graph node is identified by `mime(format)`, not by extension alone. Each handler contributes
edges from all formats marked `from` to all formats marked `to`. Generic handlers with
`supportAnyInput: true` receive extra-cost edges from every known format to their supported output
formats. More detail is in [CONVERTER_ENGINE.md](./CONVERTER_ENGINE.md).

## Project structure

```text
NaturaConverter/
|- src/
|  |- components/                 React shell and shared components
|  |  `- ui/                      UI primitives
|  |- converter-engine/
|  |  |- handlers/                Converter wrappers and vendored projects
|  |  |- CommonFormats.ts         Shared format definitions and categories
|  |  |- FormatHandler.ts         Handler and data contracts
|  |  |- PriorityQueue.ts         Graph search queue
|  |  |- TraversionGraph.ts       Graph construction and path search
|  |  |- engine.ts                Public browser API
|  |  |- errors.ts                Conversion error classes
|  |  `- normalizeMimeType.ts     Browser MIME alias normalization
|  |- hooks/                      React hooks
|  |- img/                        Source images
|  |- lib/                        Error, PDF, and shared utilities
|  |- routes/                     TanStack file routes
|  |- stores/                     In-memory workflow state
|  |- routeTree.gen.ts            Generated route tree
|  |- router.tsx                  Router factory
|  |- server.ts                   SSR error wrapper
|  |- start.ts                    Start entry support
|  `- styles.css                  Global styles
|- public/                        Source public assets
|- docs/                          Developer and operator guides
|- Dockerfile                     Bun builder and Node production image
|- docker-compose.yml             App, nginx, and Certbot services
|- nginx.conf                     TLS proxy and cache policy
|- package.json                   Scripts and dependencies
|- tsconfig.json                  Strict TypeScript and path aliases
`- vite.config.ts                 Start, Nitro, build, and copied assets
```

Several handler subdirectories are vendored projects with their own package metadata, tests, and
documentation. TypeScript excludes those source trees where the application consumes generated
JavaScript or wrapper entry points instead.

## Build flow

`bun run build` follows this path:

```text
Source and node_modules
  -> Vite 8
  -> TanStack Start plugin
  -> Nitro node-server preset
  -> viteStaticCopy and copyPdf2DocxWasm
  -> .output/server + .output/public
```

The main static-copy targets include FFmpeg, ImageMagick, Pandoc, PDF.js, 7-Zip, Reflo,
libopenmpt, FluidSynth, a soundfont, eSpeakNG, TurboWarp scaffolding, and two Typst WASM modules.
The custom `copyPdf2DocxWasm()` hook copies the full package because PDF-to-DOCX needs Pyodide,
wheels, and a Python standard-library archive rather than one WASM file.

The Vite build externalizes `canvas` and excludes several WASM packages from dependency
optimization. These settings prevent browser-targeted packages from being incorrectly bundled for
the server.

## Container flow

The Dockerfile has two stages:

1. `oven/bun:1-alpine` installs from `package.json` and `bun.lock`, copies the source, and runs the
   Vite build.
2. `node:22-alpine` receives only `.output` and `docker-entrypoint.js`, then starts the Nitro server.

The Dockerfile copies `pdf2docx-wasm` into the public output a second time after `bun run build`.
This protects the production image if plugin ordering or a future Vite change removes the first
copy.

Compose connects three services:

| Service | Network and host access | Role |
| --- | --- | --- |
| `app` | Internal port `6742`; no host port | Nitro server |
| `nginx` | Host ports `80` and `443`; proxies to `app:6742` | Public endpoint and TLS |
| `certbot` | Shared certificate and challenge directories | Renewal loop every 12 hours |

See [DEPLOYMENT.md](./DEPLOYMENT.md) for certificate bootstrap and release commands.

## Cache architecture

nginx applies two policies:

- `/` and other SSR responses receive `no-cache, no-store, must-revalidate`.
- Paths beginning with `/assets`, `/wasm`, `/js`, `/_build`, or `/__nitro` receive a one-year
  `public, immutable` policy.

Hashed browser bundles are safe under the long policy because their URL changes with content.
Several WASM and worker paths are not hashed, so a runtime upgrade at the same URL can remain in a
client cache. [DEPLOYMENT.md](./DEPLOYMENT.md#cache-invalidation) describes the required checks.

## Privacy and security boundaries

- Conversion input and output stay in browser memory.
- Runtime code and static assets are fetched from the application origin.
- nginx forwards the original host, client address, and protocol headers to Nitro.
- PDF-to-DOCX loads a large Pyodide runtime and has AGPL-3.0 and CSP implications documented in
  [`DEPLOYMENT-CAVEATS.md`](../DEPLOYMENT-CAVEATS.md).
- Browser memory exhaustion, worker crashes, and malformed files are handler failures. The graph
  may choose another path, but it cannot protect the tab from every WASM runtime failure.

## Main extension points

| Goal | Change |
| --- | --- |
| Add a route | Add a file under `src/routes/`; let TanStack regenerate `routeTree.gen.ts` |
| Add a common format | Add a `FormatDefinition` in `CommonFormats.ts` |
| Normalize a browser MIME alias | Update `normalizeMimeType.ts` |
| Add a converter | Add a handler and register it in `handlers/index.ts` |
| Add a runtime file | Add a `viteStaticCopy` target and verify `.output/public` |
| Change path preference | Adjust graph costs or format ordering with tests |
| Change the production port | Keep Compose `PORT`, `expose`, and nginx `proxy_pass` aligned |
| Change the domain | Update both `server_name` values and certificate paths in `nginx.conf` |
