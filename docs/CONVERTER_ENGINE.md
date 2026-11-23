# Converter Engine

## Overview

The converter engine is a browser-only format graph runner. Handlers declare the formats they can
read and write. `TraversionGraph` turns those declarations into weighted edges, and `engine.ts`
tries candidate paths until one completes without an error or empty output.

The public API is intentionally small:

```ts
initEngine()
detectFormat(file)
getOutputFormats(inputFormat)
convert(files, from, to)
```

## Source map

| File | Responsibility |
| --- | --- |
| `src/converter-engine/engine.ts` | Public API, caches, path execution, and retry control |
| `src/converter-engine/FormatHandler.ts` | Format, file, handler, and path-node contracts |
| `src/converter-engine/CommonFormats.ts` | Shared format definitions and category constants |
| `src/converter-engine/TraversionGraph.ts` | Graph construction, costs, dead ends, and path search |
| `src/converter-engine/PriorityQueue.ts` | Minimum-priority queue used during path search |
| `src/converter-engine/normalizeMimeType.ts` | Browser and library MIME aliases |
| `src/converter-engine/errors.ts` | `BadMagicError`, `EOFError`, and `InitializationError` |
| `src/converter-engine/handlers/index.ts` | Handler imports and registration order |

## Data model

### `IFormatDefinition`

`IFormatDefinition` describes a format independently of any converter.

| Field | Type | Meaning |
| --- | --- | --- |
| `name` | `string` | Long display name |
| `format` | `string` | Short format name used to distinguish formats with the same MIME type |
| `extension` | `string` | File extension without a required leading dot |
| `mime` | `string` | Canonical MIME type used by the graph and detector |
| `category` | `string | string[] | undefined` | One or more routing and display categories |

The category values supplied by `CommonFormats.ts` are `data`, `image`, `video`, `vector`,
`document`, `text`, `audio`, `archive`, `spreadsheet`, `presentation`, `font`, `code`, `database`,
and `model`.

### `FileFormat`

`FileFormat` extends the definition with handler-specific capabilities.

| Field | Type | Meaning |
| --- | --- | --- |
| `from` | `boolean` | The handler can read this format |
| `to` | `boolean` | The handler can write this format |
| `internal` | `string` | Identifier passed to the wrapped tool |
| `lossless` | `boolean | undefined` | Routing hint; omitted values behave as lossy in graph costs |

Two handlers may expose the same visible format with different `internal` values or capabilities.
The engine keeps each handler association while building its cache.

### `FormatDefinition`

`FormatDefinition` stores the shared fields and creates handler-specific `FileFormat` records in
two ways:

```ts
CommonFormats.PDF.supported("pdf", true, false)

CommonFormats.PDF
  .builder("pdf")
  .allowFrom()
  .markLossless()
```

`supported(ref, from, to, lossless?, override?)` returns a plain `FileFormat`. The fluent builder
starts with both directions disabled and exposes:

- `allowFrom(value = true)`
- `allowTo(value = true)`
- `markLossless(value = true)`
- `named(name)`
- `withFormat(format)`
- `withExt(extension)`
- `withMime(mime)`
- `withCategory(category)`
- `override(values)`

Use a shared `CommonFormats` definition when the name, extension, MIME type, and category already
match. Override only the values that differ for the wrapped tool.

### `FileData`

```ts
interface FileData {
  name: string;
  readonly bytes: Uint8Array;
}
```

Handlers own the lifetime and consistency of `bytes`. A handler that may mutate an input buffer
must first copy it with `new Uint8Array(input.bytes)`.

### `FormatHandler`

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

`init()` must leave `ready` set to `true` when the handler can run. Static handlers may start ready
and keep `init()` as a no-op. Dynamic handlers such as FFmpeg, ImageMagick, and Pandoc initialize a
runtime and populate `supportedFormats` from the wrapped tool.

`supportAnyInput` is reserved for generic handlers. The graph creates fallback edges from every
known format to that handler's output formats and adds a routing penalty.

### `ConvertPathNode`

Each path node pairs one `FormatHandler` with one `FileFormat`:

```ts
new ConvertPathNode(handler, format)
```

The first node describes the detected input. Every later node describes the output produced by its
associated handler.

## `engine.ts` API

### `initEngine(): Promise<void>`

Initialization is process-local to the browser module.

1. Return immediately if the engine is already initialized.
2. Return immediately during SSR when `window` is absent.
3. Dynamically import `registerHandlers()`.
4. Register handler instances in a local array.
5. Initialize every handler that is not ready.
6. Skip a handler whose initialization throws, after logging a warning.
7. Cache each remaining handler's formats by handler name.
8. Store every format and handler pair in `allOptions`.
9. Build a new `TraversionGraph` from the cache and handler array.
10. Mark the engine initialized.

Initialization is eager because `/format` must display formats discovered at runtime. A failed
handler is absent for the rest of that engine session. There is no public reset function.

### `detectFormat(file: File)`

Return type:

```ts
{ format: FileFormat; handler: FormatHandler } | null
```

The function returns `null` before initialization. After initialization, it uses this order:

1. Normalize `file.type` through `normalizeMimeType()`.
2. Read the lowercase extension after the last dot in `file.name`.
3. Find readable formats whose MIME type matches.
4. If several MIME matches exist, prefer the one whose `format` equals the extension.
5. If exactly one MIME match exists, use it.
6. If MIME matching found nothing, find the first readable format whose `format` equals the
   extension.
7. Return `null` when no candidate matches.

The extension fallback is important for browser `File` objects with an empty or generic MIME type.
MIME normalization currently covers aliases for WAV, OGG, gzip, Zstandard, icons, Aseprite, QOI,
Bink, QuickTime audio, FLO, LZH, SQLite, FLAC, font formats, MusicXML, MathML, JSON, JSON5, and WMV.

Detection uses registration and format order as its final tie breaker. Moving a handler earlier in
`handlers/index.ts` can therefore change which handler becomes the detected source.

### `getOutputFormats(inputFormat: FileFormat): FileFormat[]`

This function returns an empty array before initialization. Otherwise it walks `allOptions` and:

- keeps only formats with `to: true`;
- excludes the exact same MIME and short-format pair as the input;
- removes duplicates by the key `${mime}-${format}`;
- preserves first-seen handler and format order.

The current implementation does not query `TraversionGraph` and does not filter by source
reachability. A target can appear on `/format` even if every route to it later fails. `convert()`
is the source of truth for path availability.

### `convert(files, from, to)`

Signature:

```ts
convert(
  files: FileData[],
  from: ConvertPathNode,
  to: ConvertPathNode,
): Promise<{ files: FileData[]; path: ConvertPathNode[] } | null>
```

The function returns `null` when the graph is absent. For each call it clears engine and graph
dead-end state, then consumes paths yielded by `graph.searchPath(from, to, true)`.

For each path, `attemptConvertPath()` runs every edge in order. A successful result contains the
final files and the path that produced them. When every path fails, the function returns `null`.

The 120 second timeout shown by the application is not part of the engine. It is a
`Promise.race()` in `src/routes/download.tsx`.

## Graph construction

### Nodes

A node identifier is:

```text
<mime>(<format>)
```

For example:

```text
image/png(png)
application/pdf(pdf)
```

The graph reuses a node when that full identifier matches. Extensions and handler-internal names
do not form part of the node key.

### Standard edges

For each handler, `init()` splits its declared formats into readable and writable sets. It adds an
edge for every readable-to-writable pair except a self-loop:

```text
each format with from: true -> each format with to: true
```

The edge stores source and destination indexes, handler name, and calculated cost.

### Generic input edges

For a handler with `supportAnyInput: true`, the graph adds an edge from every known node to each of
that handler's writable formats. Duplicate source, destination, and handler edges are skipped. The
cost receives an additional `2` so specific conversions rank ahead of generic packaging paths.

`sevenZip` is a current example. It can package otherwise unknown input files into supported
archive outputs.

## Routing costs

The path finder prefers lower total cost. `TraversionGraph.ts` defines these base values:

| Cost | Value | Effect |
| --- | ---: | --- |
| Step depth | `1` | Favors shorter paths |
| Unspecified category change | `0.6` | Discourages crossing unrelated categories |
| Lossy multiplier | `1.4` | Multiplies the completed edge cost for outputs not marked lossless |
| Handler-order increment | `0.02` | Favors handlers registered earlier |
| Format-order increment | `0.05` | Favors formats listed earlier by a handler |
| Any-input increment | `2` | Places generic input support behind specific edges |

The graph also has explicit category-change costs. Examples include small penalties for image to
video and video to image, larger penalties for document to text, and very high FFmpeg-specific
penalties for category pairs that FFmpeg cannot meaningfully convert.

Adaptive costs inspect the category sequence across the whole path. The current high-cost
sequences include:

- `text -> image -> audio`
- `image -> video -> audio`
- `audio -> video -> image`

These costs steer search away from technically connected but semantically poor routes.

## Path search

`searchPath()` is an async generator that uses a priority queue and a Dijkstra-style loop.

1. Resolve source and target node indexes from `mime(format)`.
2. Seed the queue with the source path at cost zero.
3. Poll the lowest-cost queue entry.
4. Yield a path when its node is the target and handler constraints allow it.
5. Otherwise append each outgoing edge and enqueue the longer path with edge and adaptive costs.
6. Skip previously visited branches and path prefixes marked as dead ends.
7. Continue after yielding, which lets the engine request another path after a conversion failure.

`engine.ts` calls search with `simpleMode: true`. In this mode the target handler supplied by the UI
does not constrain the final edge. The graph chooses the handler that can reach the target format.

The graph exposes `addPathEventListener()` for `searching`, `found`, and `skipped` events, plus
`getData()` and `print()` for direct graph debugging. The engine's graph instance is private, so
callers that need these diagnostics must test a `TraversionGraph` instance directly or add a
purpose-built engine diagnostic API.

## Path execution and fallback

For each transition, `attemptConvertPath()`:

1. Gets the handler from the destination path node.
2. Initializes it if it is not ready.
3. Refreshes the format cache when initialization discovered formats.
4. Resolves the handler-specific input format by `from`, MIME type, and short format.
5. Uses the path format directly only when `supportAnyInput` is set.
6. Calls `handler.doConvert(files, inputFormat, outputFormat)`.
7. Waits for two animation frames in parallel so the browser can paint between steps.
8. Rejects a result when any output has zero bytes.
9. Passes the output array to the next edge.

The engine catches initialization, input-support, conversion, and empty-output failures. It logs
the handler and transition, records the failed prefix, and asks the graph for another path. A
handler exception does not escape `convert()` unless it happens outside the guarded edge loop.

This means a `null` result can represent any of these states:

- no graph node exists for the source or target;
- no connected path exists;
- all candidate handler paths failed;
- every candidate returned an empty output.

Use browser console logs to identify the failed edge before changing graph costs.

## Registering handlers

Every active handler is imported and pushed in `src/converter-engine/handlers/index.ts`:

```ts
import ExampleHandler from "./example.ts";

export function registerHandlers(handlers: FormatHandler[]) {
  try { handlers.push(new ExampleHandler()) } catch (_) { }
}
```

Add the import near related handlers and add the guarded constructor at the intended priority.
Registration order affects detection ties and graph cost. Do not remove the per-handler guard, since
one constructor failure must not prevent unrelated converters from loading.

See [HANDLERS.md](./HANDLERS.md) for the complete development checklist and asset rules.

## End-to-end API example

This follows the same basic sequence as the application routes:

```ts
import {
  convert,
  detectFormat,
  getOutputFormats,
  initEngine,
} from "@/converter-engine/engine";
import { ConvertPathNode } from "@/converter-engine/FormatHandler";

await initEngine();

const detected = detectFormat(file);
if (!detected) throw new Error("Input format was not detected.");

const output = getOutputFormats(detected.format).find(
  (format) => format.format === "png",
);
if (!output) throw new Error("PNG is not registered as an output.");

const result = await convert(
  [{ name: file.name, bytes: new Uint8Array(await file.arrayBuffer()) }],
  new ConvertPathNode(detected.handler, detected.format),
  new ConvertPathNode(detected.handler, output),
);

if (!result) throw new Error("No conversion path succeeded.");
```

The placeholder handler on the target node matches current route behavior. Because search runs in
simple mode, the graph resolves the actual output handler.

## Error classes

Handlers may use the shared classes in `errors.ts`:

| Error | Intended meaning |
| --- | --- |
| `InitializationError` | Required runtime or handler state is unavailable |
| `BadMagicError` | Input signature does not match the expected format |
| `EOFError` | Input ends before required data can be read |

The engine does not branch on these classes today. They improve handler diagnostics while all edge
failures still trigger alternate-path search.

## Current design constraints

- The engine is browser-only and module-global.
- Initialization eagerly loads every not-ready handler so the format page is complete.
- Output enumeration is global, not reachability-filtered.
- A conversion returns the first successful path, not every possible result.
- Handler and format array order is part of routing priority.
- The graph identifies formats by MIME type plus short format, so inconsistent declarations can
  create disconnected nodes.
- Temporary dead ends last for one `convert()` call and are cleared before the next call.
- Route-level state supports one source file, although handlers and engine methods accept multiple
  `FileData` inputs.
