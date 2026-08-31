# PDF-to-DOCX deployment caveats

This project uses `pdf2docx-wasm@0.1.0` for in-browser PDF-to-DOCX conversion.
Before enabling the feature in a deployed or public build, the following
constraints must be acknowledged and approved by the project owner/legal.

## 1. License

`pdf2docx-wasm` is licensed under **AGPL-3.0**. Because the conversion code
runs entirely in the user's browser and the package is distributed to the
client, standard AGPL source-distribution obligations may apply. Verify
compliance with legal counsel before shipping to production.

## 2. CSP / `eval` / WebAssembly

The dependency includes `pyodide.asm.js`, which contains `eval(...)` calls
required by Pyodide. A strict "no eval" Content Security Policy will block
PDF-to-DOCX conversion. If the application ships with a CSP, it must allow:

- WebAssembly compilation and instantiation (`wasm-unsafe-eval` is currently
  the standard directive in most browsers).
- The scripts loaded from `/wasm/pdf2docx/*`, which may require `eval` at
  runtime.

Review the security posture before enabling this on a public domain.

## 3. Client-side only

All conversion happens in the browser. No document content is uploaded to a
server, but the Pyodide runtime and supporting wheels (~50 MB total) are
fetched by the client on first use.
