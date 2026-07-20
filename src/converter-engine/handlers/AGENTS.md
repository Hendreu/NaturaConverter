# FORMAT HANDLERS

## OVERVIEW
This directory contains ~80 format handlers. Most are thin wrappers around WASM/JS libraries. Several are vendored external projects with their own `package.json` / `.github` / tests.

## STRUCTURE
```
handlers/
├── index.ts              # registerHandlers() imports and registers all handlers
├── FFmpeg.ts             # audio/video via ffmpeg.wasm
├── ImageMagick.ts        # image via magick.wasm
├── pandoc.ts             # document conversion via pandoc.wasm
├── sevenZip.ts           # archives via 7z.wasm
├── terrariawld.ts        # Terraria world parser
├── turbowarp.ts          # Scratch project packager
├── qoi-fu.ts / qoa-fu.ts # aliases to transpiled C→JS
├── sppd.ts               # Portal 2 demo parser
├── rpgmvp.ts             # RPG Maker MV decrypter
└── ... (60+ more)
```

Vendored sub-projects with own `package.json`:
`azw3`, `batToExe`, `bsor`, `envelope`, `espeakng.js`, `gimper`, `image-to-txt`, `jsonToC`, `libopenmpt`, `lzh`, `midi`, `pandoc`, `qoa-fu`, `qoi-fu`, `rpgmvp-decrypter`, `shToElf`, `sppd`, `terraria-wld-parser`, `turbowarp`.

## WHERE TO LOOK
| Task | Location |
|---|---|
| Register a new handler | `index.ts` — import and push it |
| Fix a specific format | find the matching `*.ts` wrapper |
| Add WASM/worker asset | `vite.config.ts` `viteStaticCopy` targets |
| Vendored lib issues | the submodule itself (e.g. `terraria-wld-parser/`) |

## CONVENTIONS
- Each handler is a class implementing `FormatHandler` from `../FormatHandler.ts`.
- Handlers are instantiated in `index.ts` and wrapped in `try/catch`.
- Some handlers are pure TS wrappers; others are vendored JS surfaced via `tsconfig` paths (`qoi-fu`, `qoa-fu`).
- Vendored dirs excluded from `tsc` via `tsconfig.json` `exclude`.

## ANTI-PATTERNS
- Do not edit vendored submodules unless necessary — patch the wrapper instead.
- Do not add vendored handler code to `tsconfig` includes; keep them in `exclude`.
- Do not let handler initialization crash the engine — `index.ts` already catches per handler.
