# Deployment Guide

## Production topology

The checked-in deployment runs three Docker Compose services:

```text
Internet
  -> host ports 80 and 443
  -> nginx container
  -> app container on Compose port 6742
  -> Nitro .output/server/index.mjs

certbot container
  -> shared ./certbot/conf
  -> shared ./certbot/www
```

The `app` service is not published directly to the host. `expose: 6742` makes it reachable only
inside the Compose network. Public traffic must enter through nginx.

## Deployment files

| File | Role |
| --- | --- |
| `Dockerfile` | Builds with Bun and runs the Nitro bundle on Node.js 22 |
| `.dockerignore` | Removes host dependencies, output, Git data, and unused files from build context |
| `docker-compose.yml` | Defines `app`, `nginx`, and `certbot` services |
| `docker-entrypoint.js` | Prints non-loopback container addresses before Nitro starts |
| `nginx.conf` | Configures domain, TLS, proxy headers, ACME path, and cache headers |
| `vite.config.ts` | Selects Nitro `node-server` and copies browser runtime assets |

## Image build

The Dockerfile uses two stages.

### Builder stage

```text
Base: oven/bun:1-alpine
Working directory: /app
Inputs cached first: package.json, bun.lock
Install: bun install
Build: bun run build
Output: .output/server and .output/public
```

The build accepts `ARG BUILD_VERSION`. Its value is printed in the same layer that runs
`bun run build`, so changing the value invalidates that Docker layer.

After the Vite build, the Dockerfile copies all of `node_modules/pdf2docx-wasm` to
`.output/public/wasm/pdf2docx/`. This repeats the custom Vite copy and ensures the Pyodide runtime,
Python standard library, and wheels reach the final image.

### Production stage

```text
Base: node:22-alpine
Working directory: /app
Copied files: .output and docker-entrypoint.js
Default port: 3000
Command: node docker-entrypoint.js && node .output/server/index.mjs
```

Compose overrides `PORT` to `6742` and keeps `NITRO_HOST=0.0.0.0`.

## Prerequisites

- A Linux host with Docker Engine and Docker Compose v2
- The repository checked out once in a known deployment directory
- DNS for `convert.natura.com` pointing to the host
- Inbound TCP ports 80 and 443
- Write access for Certbot under `./certbot`
- Enough disk space for Docker layers and large WASM assets
- Legal and security approval for `pdf2docx-wasm`; see
  [`DEPLOYMENT-CAVEATS.md`](../DEPLOYMENT-CAVEATS.md)

Check the tools:

```bash
docker --version
docker compose version
```

The repository uses Docker-specific Compose behavior. Do not substitute `podman-compose` on a Red
Hat host without separately validating networks, volume labels, health, and restart behavior.

## Red Hat host preparation

Start Docker and enable it after reboot:

```bash
sudo systemctl enable --now docker
sudo systemctl status docker
```

Open HTTP and HTTPS in `firewalld`:

```bash
sudo firewall-cmd --permanent --add-service=http
sudo firewall-cmd --permanent --add-service=https
sudo firewall-cmd --reload
sudo firewall-cmd --list-services
```

Create the bind-mount directories before certificate work:

```bash
mkdir -p certbot/conf certbot/www
```

### SELinux

The checked-in Compose bind mounts do not include an SELinux `:z` or `:Z` suffix. On an enforcing
host, inspect labels and recent denials if nginx or Certbot reports permission errors:

```bash
getenforce
ls -Zd certbot certbot/conf certbot/www
sudo ausearch -m AVC -ts recent
```

If SELinux is the cause, assign an approved persistent container-file label or add the shared
`:z` option to the certificate and challenge bind mounts. Use a shared label because both nginx and
Certbot access those directories. Do not disable SELinux as a shortcut.

## Domain and certificate paths

`nginx.conf` currently fixes all of these values to `convert.natura.com`:

- the port 80 `server_name`;
- the port 443 `server_name`;
- `/etc/letsencrypt/live/convert.natura.com/fullchain.pem`;
- `/etc/letsencrypt/live/convert.natura.com/privkey.pem`.

If the domain changes, update all four references and use the same domain in the Certbot command.
The DNS record must resolve to the host before certificate issuance.

## First certificate bootstrap

The TLS server block references certificate files while nginx starts. On a fresh host those files
do not exist, so the full Compose stack cannot serve the webroot challenge yet. Use a one-time
standalone Certbot container on port 80:

```bash
sudo docker compose down
sudo docker run --rm -p 80:80 \
  -v "$PWD/certbot/conf:/etc/letsencrypt" \
  -v "$PWD/certbot/www:/var/www/certbot" \
  certbot/certbot certonly \
  --standalone \
  -d convert.natura.com \
  --agree-tos \
  --no-eff-email \
  -m operations@example.com
```

Replace the email address with the monitored certificate contact. Port 80 must be free and
reachable from the internet for this command.

Confirm the files exist:

```bash
sudo ls -la certbot/conf/live/convert.natura.com/
```

Then validate and start the stack:

```bash
sudo docker compose config
sudo env BUILD_VERSION="$(git rev-parse HEAD)" docker compose up -d --build
```

## Certificate issuance with a running nginx

When nginx already starts with a valid certificate, its port 80 block serves
`/.well-known/acme-challenge/` from the shared webroot before redirecting other requests to HTTPS.
The repository's existing webroot command is then valid:

```bash
sudo docker compose run --rm --entrypoint certbot certbot certonly \
  --webroot -w /var/www/certbot \
  -d convert.natura.com \
  --agree-tos --no-eff-email \
  -m operations@example.com

sudo docker compose restart nginx
```

The long-running `certbot` service calls `certbot renew` every 12 hours. Renewal updates files in
the shared volume, but the current Compose setup does not automatically reload nginx. After a
successful renewal, reload it:

```bash
sudo docker compose exec nginx nginx -s reload
```

Check renewal logs and test periodically:

```bash
sudo docker compose logs --tail=100 certbot
sudo docker compose run --rm --entrypoint certbot certbot renew --dry-run
```

The `--entrypoint certbot` override is required for one-off commands because the service entrypoint
is the long-running 12-hour renewal loop.

## Initial deployment

Run all commands from the repository root on the server:

```bash
pwd
git rev-parse --show-toplevel
git status --short
git log --oneline -1
sudo docker compose config
sudo env BUILD_VERSION="$(git rev-parse HEAD)" docker compose up -d --build
```

Then inspect service state and logs:

```bash
sudo docker compose ps
sudo docker compose logs --tail=100 app
sudo docker compose logs --tail=100 nginx
sudo docker compose logs --tail=100 certbot
```

The app log runs `docker-entrypoint.js`, which prints addresses visible inside its container. Those
addresses are useful diagnostics, but the Compose file does not publish port `6742` to the host.
Users should open the nginx domain on HTTPS.

## Clean release workflow

Use a source revision as `BUILD_VERSION` for every release. This creates a repeatable cache key and
forces the Vite build layer to run when the revision changes.

```bash
# 1. Confirm this is the one deployment checkout.
pwd
git rev-parse --show-toplevel

# 2. Update the checkout using the repository's normal release process.
git status --short
git log --oneline -1

# 3. Stop the old stack and build from the selected revision.
sudo docker compose down
sudo env BUILD_VERSION="$(git rev-parse HEAD)" docker compose up -d --build

# 4. Verify the running services and response.
sudo docker compose ps
sudo docker compose logs --tail=100 app nginx
curl -I https://convert.natura.com/
```

`sudo env BUILD_VERSION=...` is intentional. It makes the variable available to Compose even when
the host's `sudo` policy removes caller environment variables.

Changing `BUILD_VERSION` only invalidates Docker's build layer. It does not add a visible version
to the application, purge a browser cache, or change a static asset URL.

### Full no-cache rebuild

Use this only when the normal versioned build still reuses a suspect layer:

```bash
sudo docker compose down
sudo env BUILD_VERSION="$(git rev-parse HEAD)-nocache" docker compose build --no-cache app
sudo docker compose up -d
```

This is slower because Bun dependencies and every image layer rebuild.

## Post-deploy verification

### Service and route checks

```bash
sudo docker compose ps
curl -I http://convert.natura.com/
curl -I https://convert.natura.com/
```

Expected results:

- HTTP returns a redirect to HTTPS.
- HTTPS returns a successful response.
- The HTTPS root includes `Cache-Control: no-cache, no-store, must-revalidate`.

### Runtime asset checks

Check exact files, not only directory URLs:

```bash
curl -I https://convert.natura.com/wasm/ffmpeg-core.js
curl -I https://convert.natura.com/wasm/magick.wasm
curl -I https://convert.natura.com/wasm/pandoc.wasm
curl -I https://convert.natura.com/js/pdf.worker.mjs
curl -I https://convert.natura.com/wasm/pdf2docx/pyodide.js
curl -I https://convert.natura.com/wasm/pdf2docx/pyodide.asm.wasm
```

Each should return status 200. Under the current nginx policy, these paths also receive
`Cache-Control: public, max-age=31536000, immutable`.

Confirm files inside the app container:

```bash
sudo docker compose exec -T app sh -lc \
  'test -f .output/public/wasm/ffmpeg-core.js && \
   test -f .output/public/wasm/magick.wasm && \
   test -f .output/public/wasm/pdf2docx/pyodide.js && \
   echo "runtime assets present"'
```

### Functional checks

At minimum, test in a browser:

1. Upload a small text or JSON file and complete one lightweight conversion.
2. Upload an image and complete one ImageMagick or FFmpeg conversion.
3. Convert a text-bearing PDF to DOCX and confirm the output text is selectable and editable.
4. Convert a PDF to plain text and confirm the PDF worker returns no network error.
5. Open browser developer tools and confirm required `/wasm` and `/js` requests return 200.

## nginx behavior

### Port 80

The first server block:

- listens on port 80;
- serves `/.well-known/acme-challenge/` from `/var/www/certbot`;
- redirects every other request to the same host and path on HTTPS.

### Port 443

The TLS block proxies all traffic to `http://app:6742` and forwards:

- `Host`;
- `X-Real-IP`;
- `X-Forwarded-For`;
- `X-Forwarded-Proto`.

nginx removes an upstream `Cache-Control` header before applying its own policy.

## Cache invalidation

There are three independent caches:

| Cache | What can become stale | Current control |
| --- | --- | --- |
| Docker build layers | Vite and Nitro output inside the image | Change `BUILD_VERSION`; use `--no-cache` only as a fallback |
| nginx or an upstream HTTP cache | HTML or route response | Root responses use `no-cache, no-store, must-revalidate` |
| Browser static cache | Bundles, WASM, workers, and support data | Static path prefixes use one-year `immutable` caching |

Hashed files under `/assets` are safe to cache for a year because a content change produces a new
URL. Several handler assets under `/wasm` and `/js` have fixed names. If one of those files changes
without a URL change, existing clients may continue using the old response for up to one year.

For a fixed-name runtime upgrade, choose one of these release actions:

1. Change the public filename or add an application-controlled version to its requested URL.
2. Narrow the nginx immutable rule so fixed-name runtime files revalidate.
3. For an emergency on existing code, clear the browser's site data or test in a fresh browser
   profile after confirming the origin serves the new bytes.

`BUILD_VERSION` cannot clear the third cache by itself.

Inspect current headers:

```bash
curl -sSI https://convert.natura.com/ | grep -iE 'HTTP/|cache-control|etag|last-modified'
curl -sSI https://convert.natura.com/wasm/ffmpeg-core.js | \
  grep -iE 'HTTP/|cache-control|etag|last-modified|content-length'
```

## Operating commands

| Action | Command |
| --- | --- |
| Validate Compose | `sudo docker compose config` |
| Start current images | `sudo docker compose up -d` |
| Build and start a revision | `sudo env BUILD_VERSION="$(git rev-parse HEAD)" docker compose up -d --build` |
| Follow app logs | `sudo docker compose logs -f app` |
| Follow proxy logs | `sudo docker compose logs -f nginx` |
| Show all service status | `sudo docker compose ps` |
| Restart nginx | `sudo docker compose restart nginx` |
| Reload nginx config | `sudo docker compose exec nginx nginx -s reload` |
| Validate nginx config | `sudo docker compose exec nginx nginx -t` |
| Stop and remove stack containers | `sudo docker compose down` |
| Show built images | `sudo docker compose images` |

If the operator account belongs to the `docker` group, `sudo` may be omitted according to local
policy.

## Backup and recovery

The application itself has no database or uploaded-file volume. The durable deployment data is the
certificate tree under `certbot/conf` and the source checkout used to build the image.

Back up `certbot/conf` with permissions and symbolic links preserved. Do not publish private keys
or copy them into the repository. A replacement host can rebuild the app image from source and
restore the certificate tree, or issue a new certificate after DNS is moved.

For stale releases, duplicate directories, missing assets, and certificate failures, continue with
[TROUBLESHOOTING.md](./TROUBLESHOOTING.md).
