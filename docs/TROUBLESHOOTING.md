# Troubleshooting

## Start with evidence

Before rebuilding or changing code, identify which layer is failing:

```bash
# Source checkout
pwd
git rev-parse --show-toplevel
git status --short
git log --oneline -1

# Compose and containers
sudo docker compose config
sudo docker compose ps
sudo docker compose logs --tail=100 app nginx certbot

# Public response
curl -sSI https://convert.natura.com/ | \
  grep -iE 'HTTP/|cache-control|etag|last-modified|server'
```

In the browser, open the developer tools before reproducing a conversion. Keep the Console and
Network panels visible. Handler initialization warnings, failed graph transitions, worker errors,
and missing runtime requests often explain the final error more precisely than the route UI.

## Quick symptom index

| Symptom | First check |
| --- | --- |
| Old UI after a deployment | Checkout path, running Compose project, `BUILD_VERSION`, then root cache headers |
| New HTML but old converter behavior | Fixed-name `/wasm` or `/js` response in the browser cache |
| PDF-to-DOCX contains page images | `pdf2docx` runtime files, CSP, graph logs, and whether the source PDF is scanned |
| WASM or worker request returns 404 | Matching `vite.config.ts` copy target and `.output/public` file |
| Output format is listed but conversion finds no path | `getOutputFormats()` is global; inspect graph edge failures |
| File format is not detected | Browser MIME, short `format`, extension fallback, and MIME normalization |
| Conversion stops after 120 seconds | Route timeout, large runtime startup, browser memory, or stalled handler |
| Port 6742 is unreachable from the host | Compose exposes it only to nginx, not to the host |
| nginx restarts continuously | Missing certificate files, invalid config, port conflict, or SELinux denial |
| Local and container builds differ | Bun versus npm install state and stale `node_modules` |

## Stale UI after deployment

The repository incident log records four separate causes that produced the same visible symptom:

1. Local changes never reached the server checkout.
2. The server had more than one `NaturaConverter` directory, and Compose ran from the old one.
3. Docker reused the Vite build layer.
4. A browser or proxy reused old HTML or assets.

Check them in that order.

### 1. Confirm the server source

```bash
pwd
git rev-parse --show-toplevel
git status --short
git log --oneline -1
```

Compare the final commit with the intended release. A clean Docker build cannot include changes
that are absent from this checkout.

### 2. Confirm which Compose project owns the running container

```bash
sudo docker compose ls
sudo docker compose ps

APP_ID=$(sudo docker compose ps -q app)
sudo docker inspect "$APP_ID" \
  --format '{{ index .Config.Labels "com.docker.compose.project.working_dir" }}'
```

The working-directory label should match the checkout shown by `git rev-parse --show-toplevel`.

### 3. Force the Vite build layer for the selected revision

```bash
sudo docker compose down
sudo env BUILD_VERSION="$(git rev-parse HEAD)" docker compose up -d --build
sudo docker compose logs --tail=100 app
```

The Docker build log should print the selected `BUILD_VERSION` immediately before `bun run build`.
If the result is still suspect, rebuild the app without layer cache:

```bash
sudo docker compose down
sudo env BUILD_VERSION="$(git rev-parse HEAD)-nocache" \
  docker compose build --no-cache app
sudo docker compose up -d
```

### 4. Check response cache policy

```bash
curl -sSI https://convert.natura.com/ | \
  grep -iE 'HTTP/|cache-control|etag|last-modified'
```

The root response should include:

```text
Cache-Control: no-cache, no-store, must-revalidate
```

If it does not, confirm the request reaches the checked-in nginx container and not another reverse
proxy or old host.

## Duplicate project directories

A duplicate deployment directory can build correct code while a different Compose project keeps
serving traffic.

Search only the expected parent area instead of the whole server:

```bash
find .. -maxdepth 4 -name docker-compose.yml -print
sudo docker compose ls
sudo docker ps --format 'table {{.Names}}\t{{.Image}}\t{{.Ports}}'
```

For each candidate checkout, compare:

```bash
cd /path/to/candidate
pwd
git log --oneline -1
sudo docker compose ps
```

Only one project should own host ports 80 and 443. Stop the obsolete stack from its own working
directory, then deploy from the intended checkout. Do not delete a directory until its Compose
containers, certificate location, and source revision are understood.

Port conflicts can also reveal an old stack:

```bash
sudo ss -ltnp | grep -E ':(80|443)\b'
sudo docker ps --format '{{.Names}} {{.Ports}}' | grep -E '0\.0\.0\.0:(80|443)'
```

## Cache problems

### Know which cache is stale

| Layer | Diagnostic | Fix |
| --- | --- | --- |
| Docker image | Inspect build log and image creation time | Change `BUILD_VERSION`; use `--no-cache` only if needed |
| HTML or SSR response | `curl -I /` | Restore the nginx no-cache rule and confirm the correct proxy |
| Hashed browser bundle | Compare HTML asset URL with current output | Rebuild and serve the new HTML; the URL should change |
| Fixed-name WASM or worker | Compare origin and browser response hashes | Change URL or cache rule; clear site data for emergency testing |

Inspect image creation time:

```bash
IMAGE_ID=$(sudo docker compose images -q app)
sudo docker image inspect "$IMAGE_ID" --format '{{.Created}}'
```

### Fixed-name runtime assets

The nginx rule gives all paths under `/wasm` and `/js` one year of immutable caching. Unlike hashed
Vite bundles, files such as `magick.wasm` and `pdf.worker.mjs` keep the same URL across builds.

Compare the served file with the file inside the current container:

```bash
curl -sS https://convert.natura.com/wasm/magick.wasm | sha256sum
sudo docker compose exec -T app \
  sha256sum .output/public/wasm/magick.wasm
```

If the hashes differ, first confirm the request reaches the expected server. Then test in a fresh
browser profile or clear site data. The permanent fix for a changed runtime is a versioned URL or a
cache rule that makes fixed-name assets revalidate. `BUILD_VERSION` does not purge a browser cache.

### Browser checks

In developer tools:

1. Enable the Network panel's cache-disable option while the panel is open.
2. Reload the page.
3. Inspect the request URL, status, size, response headers, and whether the response came from disk
   or memory cache.
4. Clear site data when testing a known fixed-name runtime replacement.

Do not use repeated rebuilds as a substitute for checking which response the browser received.

## PDF-to-DOCX produces images instead of editable text

The direct handler is `src/converter-engine/handlers/pdf2docx.ts`. It lazily creates:

```ts
new Pdf2Docx("/wasm/pdf2docx/")
```

That directory must contain Pyodide JavaScript and WASM, `python_stdlib.zip`, the Pyodide lock
file, and all required Python wheels. A partial copy can initialize incorrectly or make the direct
path fail. The engine may then try another graph path, including image-based intermediates.

### 1. Use a suitable test PDF

First test with a small PDF whose text is selectable in a PDF viewer. A scanned PDF contains page
images and needs OCR to become editable text. The current `pdf2docx` handler does not add a separate
OCR stage, so an image-only source is not proof of a deployment failure.

### 2. Verify the runtime inside the image

```bash
sudo docker compose exec -T app sh -lc \
  'ls -lh .output/public/wasm/pdf2docx && \
   test -f .output/public/wasm/pdf2docx/pyodide.js && \
   test -f .output/public/wasm/pdf2docx/pyodide.asm.wasm && \
   test -f .output/public/wasm/pdf2docx/python_stdlib.zip && \
   test -f .output/public/wasm/pdf2docx/pdf2docx-0.5.8-py3-none-any.whl'
```

The production copy is supplied twice:

- `copyPdf2DocxWasm()` in `vite.config.ts` copies the package during `writeBundle`.
- The Dockerfile copies the package again after `bun run build`.

If files are absent, rebuild from the current source and inspect the builder log.

### 3. Verify files through nginx

```bash
curl -I https://convert.natura.com/wasm/pdf2docx/pyodide.js
curl -I https://convert.natura.com/wasm/pdf2docx/pyodide.asm.wasm
curl -I https://convert.natura.com/wasm/pdf2docx/python_stdlib.zip
curl -I https://convert.natura.com/wasm/pdf2docx/pdf2docx-0.5.8-py3-none-any.whl
```

Every request should return status 200. A directory request such as `/wasm/pdf2docx/` may not have
an index and is not a reliable check.

### 4. Inspect browser errors and the selected graph path

Look for:

- a 404 or cached failure under `/wasm/pdf2docx/`;
- WebAssembly compilation errors;
- Pyodide package or wheel errors;
- CSP errors involving `eval`, `wasm-unsafe-eval`, scripts, or workers;
- an engine log showing `pdf2docx` failed and another transition was tried.

The package uses `eval` inside `pyodide.asm.js`. A strict Content Security Policy can block it even
when every file returns 200. Review [`DEPLOYMENT-CAVEATS.md`](../DEPLOYMENT-CAVEATS.md) before
changing policy.

### 5. Test production output, not only Vite development

The custom PDF-to-DOCX directory copy plugin has `apply: "build"`. A normal Vite development
server does not create `.output/public/wasm/pdf2docx`. Test this conversion against `bun run build`
output or the Docker image when diagnosing the production runtime.

### 6. Validate output quality

Open the resulting DOCX in Word or LibreOffice. For a text-bearing source, confirm text can be
selected and edited. Also inspect embedded images and page layout. A successful download alone does
not prove the direct converter ran.

## Missing WASM, worker, or runtime files

### Known public URLs

| Handler | Required URL or prefix |
| --- | --- |
| FFmpeg | `/wasm/ffmpeg-core.js` and related `ffmpeg-core.*` files |
| ImageMagick | `/wasm/magick.wasm` |
| Pandoc | `/wasm/pandoc.wasm` |
| PDF text extraction | `/js/pdf.worker.mjs` |
| PDF to DOCX | `/wasm/pdf2docx/` package contents |
| 7-Zip | `/wasm/7zz.wasm` |
| FLO | `/wasm/reflo_bg.wasm` and FFmpeg core for fallback decoding |
| libopenmpt | `/wasm/libopenmpt.wasm` and `/wasm/libopenmpt.js` |
| MIDI synthesis | `/wasm/libfluidsynth-2.4.6.js`, `/wasm/js-synthesizer.js`, `/wasm/TimGM6mb.sf2` |
| eSpeakNG | `/js/espeakng.worker.js` and `/js/espeakng.worker.data` |
| TurboWarp | `/js/turbowarp-scaffolding/*` |
| Typst | `/wasm/typst_ts_web_compiler_bg.wasm`, `/wasm/typst_ts_renderer_bg.wasm` |

### Build-side diagnosis

```bash
rm -rf .output
bun run build
find .output/public/wasm .output/public/js -maxdepth 2 -type f -print
```

For an absent file:

1. Find the URL literal in the consuming handler or worker.
2. Find its source and destination in `vite.config.ts`.
3. Confirm the source exists in `node_modules` or the vendored directory.
4. Confirm the copy plugin is at the top level of the Lovable config.
5. Confirm the destination exists in `.output/public`.
6. Confirm `.dockerignore` did not remove a source needed before the build.
7. Rebuild the image and check the same path inside the `app` container.

### Request-side diagnosis

```bash
curl -sSI https://convert.natura.com/wasm/magick.wasm | \
  grep -iE 'HTTP/|content-type|content-length|cache-control'
```

Check the exact path and capitalization. Also check the browser Console for a worker error or a
WASM MIME error. A status 200 with an HTML error body is not a valid runtime response, so inspect
`Content-Type` and response size.

## A handler is missing from the format list

`initEngine()` catches initialization errors, logs a warning, and continues without the failed
handler. Search the browser console for:

```text
Handler "<name>" failed to initialize
```

Then check:

- the constructor was added to `registerHandlers()`;
- the constructor guard did not catch a synchronous import or construction failure;
- `init()` completed and set `ready = true`;
- `supportedFormats` exists after initialization;
- each format has a non-empty MIME type;
- the relevant direction is marked `from` or `to`;
- runtime files loaded successfully.

Because initialization state is module-global, reload the page after fixing or replacing a failed
runtime. There is no public engine reset method.

## An output is listed but no conversion path succeeds

`getOutputFormats()` lists every unique registered format with `to: true`. It does not filter those
formats by graph reachability from the current input. The target can therefore appear in the UI
even when no valid route exists.

Use the console output from `TraversionGraph` and `attemptConvertPath()` to answer:

1. Was any graph path found?
2. Which handler and format transition failed?
3. Did the handler reject its input metadata?
4. Did it return an empty output?
5. Did every alternate path hit a recorded dead end?

Do not add a direct edge manually. Handler `from` and `to` declarations create edges. Fix incorrect
metadata or the failing wrapper, then let the graph rebuild during a page reload.

## Wrong or missing input detection

Detection uses normalized browser MIME first and the file-name extension second. The extension is
compared with `FileFormat.format`, not `FileFormat.extension`.

In the browser console, inspect:

```js
({ name: file.name, type: file.type })
```

Then check:

- `normalizeMimeType.ts` for an alias supplied by the browser;
- a readable format with the normalized MIME;
- a short `format` that matches the lowercase suffix;
- registration order when several handlers declare the same MIME;
- whether `initEngine()` finished before `detectFormat()` ran.

If a common alias is absent, add it in `normalizeMimeType.ts`. If only one handler is wrong, correct
that handler's declaration instead of adding a global alias.

## Conversion timeout or browser memory failure

`src/routes/download.tsx` races conversion against a 120 second timer. The engine and handlers do
not share a global cancellation signal, so the browser runtime may continue work after the route
reports a timeout.

Check these factors:

- first-use downloads for FFmpeg, Pandoc, ImageMagick, Typst, or Pyodide;
- input size and number of frames or pages;
- browser tab memory and WASM allocation errors;
- an FFmpeg process that stalled rather than threw;
- a worker initialization timeout;
- a fixed-name runtime being loaded from an old cache;
- a path with several expensive intermediate conversions.

Reproduce with a small known-good input. If that works, measure the failing format and file size
before increasing any timeout. A longer timeout does not fix a crashed worker or exhausted browser
memory.

## The app is not reachable on port 6742

This is expected from the host under the checked-in Compose file:

```yaml
app:
  expose:
    - "6742"
```

`expose` does not publish a host port. Test through nginx on ports 80 or 443:

```bash
curl -I http://localhost/
curl -kI https://localhost/ -H 'Host: convert.natura.com'
```

Test the internal service from the nginx container:

```bash
sudo docker compose exec nginx \
  wget -S -O /dev/null http://app:6742/
```

For a local image smoke test without nginx, run the image directly with `-p 3000:3000` as shown in
[README.md](./README.md#quick-start-local-docker-image).

## nginx fails because certificates are missing

Check the proxy log and mounted certificate tree:

```bash
sudo docker compose logs --tail=100 nginx
sudo ls -la certbot/conf/live/convert.natura.com/
```

On a fresh host, the TLS config cannot load before the first certificate exists. Follow the
standalone bootstrap in [DEPLOYMENT.md](./DEPLOYMENT.md#first-certificate-bootstrap). Also check:

- DNS points to this host;
- port 80 is open and unused during standalone issuance;
- certificate paths match the domain in `nginx.conf`;
- SELinux permits both containers to access the shared directories;
- no older container owns ports 80 or 443.

Validate nginx after the files exist:

```bash
sudo docker compose exec nginx nginx -t
sudo docker compose restart nginx
```

## A renewed certificate is not being served

The Certbot loop updates files in the shared volume, but nginx does not automatically reload them.

```bash
sudo docker compose logs --tail=100 certbot
sudo docker compose exec nginx nginx -s reload
```

Compare the live certificate dates after reload:

```bash
echo | openssl s_client -connect convert.natura.com:443 \
  -servername convert.natura.com 2>/dev/null | \
  openssl x509 -noout -dates -issuer -subject
```

## Bun and npm produce different installs

The repository tracks `bun.lock` and `package-lock.json`, but its normal and container workflows are
not symmetric:

- the Dockerfile copies `package.json` and `bun.lock`;
- the Dockerfile runs `bun install`;
- `.dockerignore` excludes `package-lock.json`;
- package scripts are normally run through Bun.

An `npm install` can update `package-lock.json` and create a different `node_modules` tree without
updating `bun.lock`. The local application may then differ from Docker.

Inspect dependency-file changes:

```bash
git diff -- package.json bun.lock package-lock.json
```

Restore a Bun-matched local install:

```bash
rm -rf node_modules .output
bun install
bun run typecheck
bun run build
```

PowerShell equivalent for the cleanup step:

```powershell
Remove-Item -Recurse -Force node_modules, .output -ErrorAction SilentlyContinue
bun install
```

If npm was run unintentionally and only `package-lock.json` changed, restore that file from source
control. If npm support is an intentional release requirement, regenerate and review both lockfile
workflows explicitly. Do not assume one package manager keeps the other's lockfile current.

## Bun install fails in the Alpine builder

The builder uses `oven/bun:1-alpine`, which is based on musl. If a new native dependency has no
musl-compatible package, reproduce outside cached layers:

```bash
sudo docker compose build --no-cache app
```

Identify the dependency before changing the base image. If glibc is required, test the non-Alpine
`oven/bun:1` builder while keeping the Node production stage unchanged unless its runtime also
needs the native module.

## `canvas` is missing at server runtime

`vite.config.ts` ignores or externalizes `canvas` in both CommonJS and Rolldown build settings. This
keeps browser PDF packages from forcing a native canvas dependency into normal server output.

If a future server-import path throws `MODULE_NOT_FOUND` for `canvas`:

1. Find why browser-only code entered the SSR graph.
2. Prefer moving that import behind a browser-only dynamic boundary.
3. Add a native production dependency only when the server truly needs canvas.

Alpine native modules may also need system packages, so installing `canvas` in the final image is
not a safe default fix.

## Typecheck errors inside vendored handlers

Run the repository check from the root package:

```bash
bun run typecheck
```

`tsconfig.json` deliberately excludes source trees such as `qoi-fu`, `qoa-fu`, `sppd`,
`espeakng.js`, selected `image-to-txt` files, and `terraria-wld-parser`. The application consumes
wrappers, generated JavaScript, or aliases instead.

Do not typecheck those vendored trees as if they followed the root application settings. If a
vendored project has its own tests or compiler configuration, run commands from that subproject.

## Collect a diagnostic bundle

These commands capture enough evidence for most deployment reports without including document
contents or certificate private keys:

```bash
{
  date -Is
  pwd
  git rev-parse --show-toplevel
  git log --oneline -1
  git status --short
  docker compose version
  sudo docker compose config --services
  sudo docker compose ps
  sudo docker compose images
  sudo docker compose logs --tail=200 app nginx certbot
  curl -sSI https://convert.natura.com/
  curl -sSI https://convert.natura.com/wasm/ffmpeg-core.js
  curl -sSI https://convert.natura.com/wasm/pdf2docx/pyodide.js
} > natura-converter-diagnostics.txt 2>&1
```

Review the file before sharing it. Do not add browser-uploaded files, converted outputs,
`certbot/conf`, environment secrets, or private keys.
