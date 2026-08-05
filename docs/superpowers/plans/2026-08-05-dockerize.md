# Dockerize NaturaConverter Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Containerize the NaturaConverter TanStack Start app with a Node.js standalone server via Docker multi-stage build.

**Architecture:** Multi-stage Dockerfile (Bun builder → Node prod), docker-compose orchestration, Nitro preset switch from cloudflare-module to node-server.

**Tech Stack:** Bun, Node.js 22, Nitro (node-server preset), Docker, docker-compose

## Global Constraints
- Use `oven/bun:1-alpine` for build stage (honors `bun.lock`)
- Use `node:22-alpine` for prod stage (runs Nitro node-server output)
- Preserve all WASM and static assets in final image
- Do not break existing `bun run dev` workflow on :8080
- Do not add TanStack/Tailwind/Nitro plugins to vite.config.ts (per AGENTS.md)
- Branch name: `dockerize-app` (≤3 hyphenated words)
- Conventional commits: `feat(build):` for vite.config.ts, `chore(docker):` for infra files
- Do not force-push / rebase / amend pushed commits (Lovable sync rule)

---

## File Structure

| File | Responsibility |
|------|---------------|
| `vite.config.ts` | Switch Nitro preset to `node-server` (one-line config addition) |
| `Dockerfile` | Multi-stage build: Bun install + build → Node runtime |
| `docker-compose.yml` | Orchestrate `app` service, map port 3000 |
| `.dockerignore` | Exclude host artifacts from build context |

---

## Task Dependency Graph

| Task | Depends On | Reason |
|------|------------|--------|
| Task 1: Switch Nitro preset | None | Foundational; defines build artifact shape |
| Task 3: docker-compose + .dockerignore | None | Pure infra files, no build dependency |
| Task 2: Dockerfile | Task 1 | Build stage runs `bun run build`, needs node-server preset |
| Task 4: Build + smoke-test | Task 1, 2, 3 | Exercises full pipeline |

## Parallel Execution Graph

```
Wave 1 (Start immediately):
├── Task 1: vite.config.ts — add nitro: { preset: "node-server" }
└── Task 3: docker-compose.yml + .dockerignore

Wave 2 (After Wave 1):
└── Task 2: Dockerfile

Wave 3 (After Wave 2):
└── Task 4: docker compose build/up + smoke tests
```

---

## Tasks

### Task 1: Switch Nitro preset to `node-server`

**Files:**
- Modify: `vite.config.ts`

**Interfaces:**
- Consumes: Existing `defineConfig` from `@lovable.dev/vite-tanstack-config`
- Produces: `nitro: { preset: "node-server" }` option forwarded to Nitro plugin

- [ ] **Step 1: Add nitro preset option**

Inside `export default defineConfig({ ... })`, add `nitro: { preset: "node-server" }` as a sibling of `tanstackStart` and `vite`:

```ts
export default defineConfig({
  tanstackStart: {
    server: { entry: "server" },
  },
  nitro: { preset: "node-server" },
  vite: {
    // ... existing plugins and config unchanged ...
```

- [ ] **Step 2: Verify typecheck passes**

Run: `bun run typecheck`
Expected: exit 0

- [ ] **Step 3: Verify local build emits node-server output**

Run: `bun run build`
Expected: `.output/server/index.mjs` exists; `.output/server/wrangler.json` does NOT exist (indicates node-server, not cloudflare-module)

- [ ] **Step 4: Commit**

```bash
git add vite.config.ts
git commit -m "feat(build): switch nitro preset to node-server"
```

---

### Task 2: Create `Dockerfile` (multi-stage)

**Files:**
- Create: `Dockerfile`

**Interfaces:**
- Consumes: Task 1's node-server preset output (`.output/` directory)
- Produces: Docker image with Node.js server on port 3000

- [ ] **Step 1: Write multi-stage Dockerfile**

```dockerfile
# syntax=docker/dockerfile:1

# ---- builder: install + build with Bun (bun.lock is source of truth) ----
FROM oven/bun:1-alpine AS builder
WORKDIR /app

# Cache the install layer independently of source changes.
COPY package.json bun.lock ./
RUN bun install --frozen-lockfile

# Source is needed for viteStaticCopy (pulls WASM/JS from node_modules + src/)
COPY . .

# Emits .output/server/index.mjs + .output/public/** (node-server preset)
RUN bun run build

# ---- prod: run the Nitro node-server bundle on Node 22 ----
FROM node:22-alpine AS prod
WORKDIR /app

# Self-contained server + public assets (wasm, js, hashed bundles).
COPY --from=builder /app/.output ./.output

ENV NODE_ENV=production
ENV PORT=3000
EXPOSE 3000

CMD ["node", ".output/server/index.mjs"]
```

- [ ] **Step 2: Verify Docker build succeeds**

Run: `docker build .`
Expected: Both stages complete without error

- [ ] **Step 3: Verify image contains required assets**

Run: `docker build . -t natura-converter:test && docker run --rm natura-converter:test ls -la .output/public/wasm/`
Expected: List includes `7zz.wasm` and other WASM files

- [ ] **Step 4: Commit**

```bash
git add Dockerfile
git commit -m "chore(docker): add multi-stage Dockerfile"
```

---

### Task 3: Create `docker-compose.yml` + `.dockerignore`

**Files:**
- Create: `docker-compose.yml`
- Create: `.dockerignore`

**Interfaces:**
- Consumes: Dockerfile from Task 2
- Produces: Orchestrated container on host port 3000

- [ ] **Step 1: Write docker-compose.yml**

```yaml
services:
  app:
    build: .
    ports:
      - "3000:3000"
```

- [ ] **Step 2: Write .dockerignore**

```
node_modules
.output
dist
dist-ssr
.nitro
.vinxi
.tanstack
.git
.gitignore
.wrangler
.dev.vars
package-lock.json
*.log
.DS_Store
.vscode
.idea
README.md
AGENTS.md
```

- [ ] **Step 3: Validate compose config**

Run: `docker compose config`
Expected: Validates without error

- [ ] **Step 4: Commit**

```bash
git add docker-compose.yml .dockerignore
git commit -m "chore(docker): add docker-compose and dockerignore"
```

---

### Task 4: Build + smoke-test (verification)

**Files:**
- None (verification only)

**Interfaces:**
- Consumes: All files from Tasks 1-3
- Produces: Evidence artifacts (command outputs, curl responses)

- [ ] **Step 1: Build image via compose**

Run: `docker compose build`
Expected: Builds successfully

- [ ] **Step 2: Start container**

Run: `docker compose up -d`
Expected: Container starts, service shows `Up`

- [ ] **Step 3: HTTP smoke test — root path**

Run: `curl -sS -o /dev/null -w "%{http_code}" http://localhost:3000`
Expected: `200`

- [ ] **Step 4: HTTP smoke test — WASM asset**

Run: `curl -sS -o /dev/null -w "%{http_code}" http://localhost:3000/wasm/7zz.wasm`
Expected: `200`

- [ ] **Step 5: Check for canvas runtime error**

Run: `docker compose logs app | grep -i canvas`
Expected: No `MODULE_NOT_FOUND canvas` error (if found, add `npm install --omit=dev canvas` to prod stage)

- [ ] **Step 6: Verify dev workflow untouched**

Run: `bun run dev` then Ctrl+C after confirming startup
Expected: Starts on port 8080 without errors

- [ ] **Step 7: Capture evidence in notepad**

Append all command outputs to the ultrawork notepad file.

---

## Risk Notes

**musl fallback:** `oven/bun:1-alpine` uses musl. If `bun install --frozen-lockfile` fails on a native-addon dep, swap ONLY the builder base to `oven/bun:1` (Debian, glibc). Keep `node:22-alpine` for prod.

**canvas externalized:** `canvas` is in `build.commonjsOptions.ignore` and `build.rolldownOptions.external`. If runtime crashes with `MODULE_NOT_FOUND canvas`, install it in the prod stage: `RUN npm install --omit=dev canvas`.

**Lovable sandbox:** The preset override only applies outside `LOVABLE_SANDBOX=1`. Inside the sandbox, the Lovable config still forces `cloudflare-module`, so Lovable sync is untouched.

---

## Commit Strategy

Two atomic commits on branch `dockerize-app`:

1. `feat(build): switch nitro preset to node-server` — `vite.config.ts` only
2. `chore(docker): add Dockerfile, compose, and dockerignore` — `Dockerfile`, `docker-compose.yml`, `.dockerignore`

Do not force-push / rebase / amend pushed commits (per AGENTS.md Lovable sync rule).
