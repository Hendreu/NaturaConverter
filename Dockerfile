# syntax=docker/dockerfile:1

# ---- builder: install + build with Bun (bun.lock is source of truth) ----
FROM oven/bun:1-alpine AS builder
WORKDIR /app

# Cache the install layer independently of source changes.
COPY package.json bun.lock ./
RUN bun install

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
ENV NITRO_HOST=0.0.0.0
EXPOSE 3000

CMD ["node", ".output/server/index.mjs"]
