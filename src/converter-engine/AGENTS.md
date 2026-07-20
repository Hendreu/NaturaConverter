# CONVERTER ENGINE

## OVERVIEW
The engine is a format-graph runner. `engine.ts` exposes a small API: `initEngine`, `detectFormat`, `getOutputFormats`, `convert`. `TraversionGraph.ts` finds multi-step conversion paths between formats.

## STRUCTURE
```
src/converter-engine/
├── engine.ts            # public API
├── FormatHandler.ts     # contract: FileFormat, FileData, FormatHandler, ConvertPathNode
├── TraversionGraph.ts   # Dijkstra-style path search over handlers
├── PriorityQueue.ts     # min-heap used by the graph
├── CommonFormats.ts     # shared FormatDefinition builders
├── normalizeMimeType.ts # MIME aliasing
├── errors.ts            # InitializationError
├── types.d.ts           # ambient types
└── handlers/            # AGENTS.md there
```

## WHERE TO LOOK
| Task | Location |
|---|---|
| Add a new handler | `handlers/` + `handlers/index.ts` |
| Change format detection | `engine.ts` `detectFormat` |
| Change multi-hop routing | `engine.ts` + `TraversionGraph.ts` |
| Add MIME aliases | `normalizeMimeType.ts` |
| Build format definitions | `CommonFormats.ts` |

## CONVENTIONS
- `FormatHandler` is the only contract a handler must implement.
- `FormatDefinition.builder(ref)` is the standard way to create `FileFormat`s.
- `engine.ts` is browser-only; `typeof window === "undefined"` returns early.
- `initEngine` eagerly calls `handler.init()` so all formats appear on `/format`.

## ANTI-PATTERNS
- Do not let `initEngine` throw because of one handler — all handlers are wrapped in `try/catch` in `handlers/index.ts`.
- Do not mutate input `bytes` in `doConvert`; copy into a new `Uint8Array` if needed.
- Do not call `convert` before `initEngine` finishes.
