# Format Handlers

## Overview

`src/converter-engine/handlers/` contains the wrappers that perform conversions. Most wrappers
adapt a browser library, WebAssembly module, worker, or vendored project to the common
`FormatHandler` contract.

The registry currently imports many focused handlers. Do not treat every subdirectory as
application-owned source. Several directories are vendored projects with their own package files,
generated output, tests, and licenses.

## Handler contract

Every active handler implements the interface in `src/converter-engine/FormatHandler.ts`:

```ts
interface FormatHandler {
  name: string;
  supportedFormats?: FileFormat[];
  supportAnyInput?: boolean;
  ready: boolean;
  init: () => Promise<void>;
  doConvert: (
    inputFiles: FileData[],
    inputFormat: FileFormat,
    outputFormat: FileFormat,
    args?: string[],
  ) => Promise<FileData[]>;
}
```

The engine expects these rules:

- `name` is stable and unique in the registry.
- `supportedFormats` lists every readable and writable graph endpoint.
- `init()` sets `ready` to `true` after all required state is available.
- `doConvert()` returns one or more named, non-empty `Uint8Array` outputs.
- Input buffers are copied before a library that may mutate them receives the data.
- Unsupported directions throw instead of returning unrelated or empty data.
- Browser-only globals are accessed during `init()` or `doConvert()`, not at module import time
  where possible.

The engine catches handler initialization and conversion failures, marks the failed graph prefix,
and may try another path. Clear errors are still valuable because the browser console is the main
place to identify the failing edge.

## Static and dynamic format declarations

### Static formats

Small wrappers can declare formats when the class is constructed. `pdfparse.ts` follows this
pattern:

```ts
public supportedFormats: FileFormat[] = [
  CommonFormats.PDF.builder("pdf").allowFrom(),
  CommonFormats.TEXT.builder("txt").allowTo(),
];
```

Use `CommonFormats` when its display name, short name, extension, MIME type, and category are
correct. The builder starts with both directions disabled. Set only the directions the handler
actually supports.

### Dynamic formats

Wrappers for tools that report their own capabilities populate `supportedFormats` in `init()`:

- FFmpeg runs `-formats` and queries muxer details.
- ImageMagick reads `Magick.supportedFormats`.
- Pandoc queries `input-formats` and `output-formats`.
- 7-Zip runs `7zz i` and parses its format table.

Dynamic discovery keeps the format list aligned with the bundled runtime. It also makes
initialization part of the format-page load, because `initEngine()` eagerly initializes not-ready
handlers before it builds the graph.

## Adding a handler

### 1. Define the conversion boundary

Write down the exact input and output formats before adding code:

- visible short format and extension;
- canonical MIME type;
- graph category;
- wrapped tool's internal identifier;
- readable, writable, or both;
- lossless or lossy for this specific conversion;
- one input to one output, many inputs to one output, or one input to many outputs.

Wrong metadata can be harder to diagnose than conversion code. The graph joins nodes by
`mime(format)`, detection compares MIME and short format, and output filenames use `extension`.

### 2. Reuse an existing format definition

Check `src/converter-engine/CommonFormats.ts` first. For example:

```ts
CommonFormats.PDF.builder("pdf").allowFrom()
CommonFormats.DOCX.builder("docx").allowTo()
```

Create a direct `FileFormat` object only when the shared definition does not describe the format.
If the format is common across several handlers, add one `FormatDefinition` to `CommonFormats`
instead of copying metadata.

### 3. Implement initialization

Choose the smallest initialization model that matches the runtime:

| Runtime behavior | Handler pattern |
| --- | --- |
| Pure JavaScript with no setup | Start with `ready = true`; keep `init()` as a no-op |
| Static format list, lazy large runtime | Start ready, load the runtime inside the first `doConvert()` call |
| Runtime reports supported formats | Start not ready, initialize and populate formats in `init()` |
| Worker or WASM must exist before conversion | Fetch or start it in `init()`, then set `ready = true` |

`pdf2docx` and eSpeakNG use lazy loading so their large runtimes are not fetched during general
engine initialization. FFmpeg, ImageMagick, Pandoc, 7-Zip, Typst, and several other handlers must
initialize before their complete format list or runtime is available.

Do not set `ready = true` before required state has finished loading. Use `InitializationError`
when `doConvert()` detects missing initialized state.

### 4. Implement conversion

A conversion method should:

1. Reject unsupported input or output identifiers.
2. Copy bytes when the wrapped library may mutate its input.
3. Process every input file or clearly document aggregation behavior.
4. Preserve the base name where practical.
5. Use `outputFormat.extension` for the generated suffix.
6. Return every companion file needed by a later path step.
7. Reject malformed or empty results.
8. Release object URLs, workers, parsers, and virtual filesystem files when the library permits it.

`pdfparse.ts` is a small existing model. It creates a parser per PDF, calls `getText()`, destroys
the parser, encodes the text, and replaces the `.pdf` suffix with `.txt`.

For multi-step routes, output names can also be virtual asset paths. Pandoc returns a main Typst
source plus `media/...` entries when it extracts images from DOCX or ODT. The Typst handler maps
those companion entries into its virtual filesystem before compilation.

### 5. Register the class

Add an import to `src/converter-engine/handlers/index.ts`, then add a guarded push inside
`registerHandlers()`:

```ts
try { handlers.push(new HandlerClass()) } catch (_) { }
```

Keep the guard. It isolates constructor failures. `initEngine()` separately isolates async
initialization failures.

Registration position matters. Earlier handlers receive a lower graph cost, and first-seen formats
win final detection and output-deduplication ties. Put a handler where its priority is intentional,
not simply at a random position.

### 6. Add browser runtime assets

If source code fetches a root-relative file such as `/wasm/tool.wasm`, add a matching source to the
top-level `viteStaticCopy` targets in `vite.config.ts`. The destination is relative to
`.output/public`.

Keep the static-copy plugin at the top level of the Lovable configuration. The repository comment
records that it must run before TanStack and Nitro internal plugins. Do not add duplicate TanStack,
React, Tailwind, path-alias, or Nitro plugins.

When one package needs a directory rather than one file, use a focused build hook. The existing
`copyPdf2DocxWasm()` hook copies all of `node_modules/pdf2docx-wasm` to
`.output/public/wasm/pdf2docx`.

### 7. Verify the handler

Run the static checks and production build:

```bash
bun run typecheck
bun run lint
bun run test
bun run build
```

Check required output files after the build:

```bash
find .output/public/wasm .output/public/js -maxdepth 2 -type f -print
```

Then test in a browser. Confirm all of these points:

- input detection chooses the expected format and handler;
- the target appears on `/format`;
- every runtime request returns status 200;
- the browser console has no worker, CSP, MIME, or WASM errors;
- output bytes are non-empty;
- the output opens in a separate, trusted application;
- a malformed input fails without hanging the tab;
- if another graph path exists, the expected path was actually used.

`qa-engine.ts` covers registry checks and selected Node-safe paths, but it has browser shims,
skips browser-only conversions, and currently reads a PNG fixture from a machine-specific absolute
path. It is not a replacement for browser testing.

## Fixing an existing handler

Use the wrapper as the first repair point unless the defect is inside the vendored library itself.

1. Reproduce one direct input and output pair.
2. Record the failing transition from the browser console, not only the final route message.
3. Verify `inputFormat.internal` and `outputFormat.internal` against the wrapped tool.
4. Check every network request under `/wasm` and `/js`.
5. Confirm `init()` sets `ready` only after its required state exists.
6. Confirm `supportedFormats` directions match what `doConvert()` handles.
7. Check whether the library detached or mutated an input buffer.
8. Check virtual filesystem cleanup and repeated-conversion behavior.
9. Build production output, since the development server can hide missing-copy problems.
10. Retest the direct conversion and at least one graph route that includes the handler.

The engine can hide a first failure by choosing a second path. When output quality is wrong, inspect
the logged path and handler names before changing the wrapper you expected to run.

## Key handlers

### FFmpeg

| Property | Implementation |
| --- | --- |
| File | `src/converter-engine/handlers/FFmpeg.ts` |
| Scope | Audio, video, and selected image containers reported by the bundled FFmpeg build |
| Runtime URL | `/wasm/ffmpeg-core.js` plus related `ffmpeg-core.*` files |
| Build source | `node_modules/@ffmpeg/core/dist/esm/ffmpeg-core.*` |
| Format discovery | `ffmpeg -formats` and per-muxer help output |

The handler removes unsupported or stalled AVIF, HEVC, and RTSP entries, adds QuickTime audio and
WMV metadata, normalizes Bink input, and adds explicit PNG input. It terminates FFmpeg after format
discovery and reloads a fresh instance for conversion.

`execSafe()` can reload FFmpeg after selected out-of-bounds failures and applies a Promise-level
timeout during discovery. Conversion retries itself with padding, a valid size, or an accepted
sample rate when FFmpeg reports one of those constraints. Empty or absent output is rejected.

### ImageMagick

| Property | Implementation |
| --- | --- |
| File | `src/converter-engine/handlers/ImageMagick.ts` |
| Scope | ImageMagick-readable and writable image-like formats |
| Runtime URL | `/wasm/magick.wasm` |
| Build source | `node_modules/@imagemagick/magick-wasm/dist/magick.wasm` |
| Format discovery | `Magick.supportedFormats` |

Initialization excludes APNG, SVG, TTF, OTF, text, video, JSON, and entries without a usable MIME
type. PDF is deliberately disabled as an ImageMagick input. ICO output is resized to at most
256 by 256 pixels. Multiple input frames are collected into one output collection.

### Pandoc

| Property | Implementation |
| --- | --- |
| File | `src/converter-engine/handlers/pandoc.ts` |
| Scope | Document, text, markup, office, bibliography, and presentation formats reported by Pandoc |
| Runtime URL | `/wasm/pandoc.wasm` |
| Build source | `src/converter-engine/handlers/pandoc/pandoc.wasm` |
| Format discovery | Pandoc `input-formats` and `output-formats` queries |

The handler adds MathML output manually, maps Pandoc's `plain` name to `text`, and excludes PDF and
RevealJS because those paths are disabled in the current wrapper. It enables embedded resources
for output.

For DOCX or ODT to Typst, it opens the office ZIP package with JSZip, extracts embedded media,
rewrites image paths to `media/`, and returns the main Typst file plus companion assets. This is
required for a later Typst to PDF or SVG step.

### PDF to DOCX

| Property | Implementation |
| --- | --- |
| File | `src/converter-engine/handlers/pdf2docx.ts` |
| Scope | PDF input to DOCX output |
| Runtime URL | `/wasm/pdf2docx/` |
| Build source | Complete `node_modules/pdf2docx-wasm` directory |
| Loading | Lazy import and converter construction on first use |

The package directory contains Pyodide JavaScript and WASM, the Python standard library, a lock
file, and Python wheels for pdf2docx and its dependencies. The first use downloads about 50 MB.
Both `vite.config.ts` and the Dockerfile copy this directory into production output.

`pdf2docx-wasm@0.1.0` is AGPL-3.0. Its Pyodide code also needs a CSP that permits the required
WebAssembly and `eval` behavior. Read [`DEPLOYMENT-CAVEATS.md`](../DEPLOYMENT-CAVEATS.md) before a
public release.

### PDF text extraction

| Property | Implementation |
| --- | --- |
| File | `src/converter-engine/handlers/pdfparse.ts` |
| Scope | PDF input to plain-text output |
| Worker URL | `/js/pdf.worker.mjs` |
| Build source | `node_modules/pdf-parse/dist/pdf-parse/web/pdf.worker.mjs` |

`init()` configures the PDF.js worker. Each conversion creates `PDFParse`, calls `getText()`, and
destroys the parser before returning UTF-8 text.

### PDF page images

| Property | Implementation |
| --- | --- |
| File | `src/converter-engine/handlers/pdftoimg.ts` |
| Scope | PDF input to one PNG or JPEG per page |
| Runtime | `pdftoimg-js/browser` from the application bundle |

The handler creates an object URL, asks the library for every page as a data URL, decodes each
base64 result, and names outputs with a zero-based page suffix. This is a separate graph edge from
PDF-to-DOCX.

### 7-Zip

| Property | Implementation |
| --- | --- |
| File | `src/converter-engine/handlers/sevenZip.ts` |
| Scope | Archive discovery, extraction, repacking, compressed TAR handling, and generic packaging |
| Runtime URL | `/wasm/7zz.wasm` |
| Build source | `node_modules/7z-wasm/7zz.wasm` |

The handler has `supportAnyInput: true`, so the graph may use it to package any known input. Its
format list comes from parsing `7zz i`. Generic edges receive the engine's extra any-input cost.

### Typst

| Property | Implementation |
| --- | --- |
| File | `src/converter-engine/handlers/typst.ts` |
| Scope | Typst input to PDF or SVG output |
| Runtime URLs | `/wasm/typst_ts_web_compiler_bg.wasm` and `/wasm/typst_ts_renderer_bg.wasm` |

The handler uses `import.meta.env.BASE_URL` to form the two URLs. It maps companion files from
Pandoc into Typst's shadow filesystem before compiling the main `.typ` source.

## Additional copied runtimes

These mappings come directly from `vite.config.ts` and the consuming handlers:

| Consumer | Public runtime | Build source |
| --- | --- | --- |
| FLO worker | `/wasm/reflo_bg.wasm` | `node_modules/@flo-audio/reflo/reflo_bg.wasm` |
| FLO fallback | `/wasm/ffmpeg-core.js` | FFmpeg core copy target |
| libopenmpt | `/wasm/libopenmpt.wasm`, `/wasm/libopenmpt.js` | Vendored `handlers/libopenmpt/` files |
| MIDI synthesizer | `/wasm/libfluidsynth-2.4.6.js` | `js-synthesizer` external runtime |
| MIDI synthesizer | `/wasm/js-synthesizer.js` | `js-synthesizer` package bundle |
| MIDI synthesizer | `/wasm/TimGM6mb.sf2` | `handlers/midi/TimGM6mb.sf2` |
| eSpeakNG | `/js/espeakng.worker.js` and its `.data` file | Vendored `handlers/espeakng.js/js/` files |
| TurboWarp | `/js/turbowarp-scaffolding/*` | `turbowarp-packager-browser/dist/scaffolding/*` |

FLO starts a module worker that loads Reflo and can fall back to FFmpeg for audio decoding.
libopenmpt loads a patched classic script and pre-fetched WASM to render tracker modules to WAV.
The MIDI synthesizer loads FluidSynth, the JavaScript synthesizer wrapper, and a soundfont to render
MIDI to WAV. eSpeakNG lazily converts text to WAV. TurboWarp rewrites its large-asset URLs before
converting between Scratch 3 projects and HTML.

## Vendored handler code

The repository includes vendored subprojects such as `azw3`, `batToExe`, `bsor`, `envelope`,
`espeakng.js`, `gimper`, `image-to-txt`, `jsonToC`, `libopenmpt`, `lzh`, `midi`, `pandoc`, `qoa-fu`,
`qoi-fu`, `rpgmvp-decrypter`, `shToElf`, `sppd`, `terraria-wld-parser`, and `turbowarp`.

Prefer a small change in the top-level TypeScript wrapper when it can adapt inputs, outputs, paths,
or metadata. Change vendored code only when the underlying implementation is the defect. Preserve
its license and build assumptions, and run any tests supplied by that subproject.

`tsconfig.json` excludes selected vendored trees from the application typecheck. Do not add those
trees back merely to remove an editor warning. The application consumes their generated
JavaScript, path alias, or typed wrapper instead.

## Runtime asset checklist

When a handler works in development but fails after `bun run build`, check this sequence:

1. Find the exact root-relative URL in the handler or worker.
2. Find the matching copy target in `vite.config.ts`.
3. Confirm the source exists after `bun install`.
4. Confirm the destination exists under `.output/public`.
5. Confirm the Docker image contains the destination.
6. Request the exact file URL through nginx and check status, content type, and cache headers.
7. Check the browser network panel for a cached failure or stale immutable response.

See [TROUBLESHOOTING.md](./TROUBLESHOOTING.md#missing-wasm-worker-or-runtime-files) for commands.
