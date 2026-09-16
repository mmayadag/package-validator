# syntax=docker/dockerfile:1
# Build context is the repository root: the UI depends on the workspace package in packages/contracts.

FROM node:26-alpine AS build
WORKDIR /app
COPY package.json package-lock.json ./
COPY packages/contracts/package.json packages/contracts/
COPY api/package.json api/
COPY ui/package.json ui/
RUN npm ci --workspace ui --workspace packages/contracts --no-audit --no-fund
COPY tsconfig.base.json ./
COPY packages/contracts/tsconfig.json packages/contracts/
COPY packages/contracts/src packages/contracts/src
COPY ui/tsconfig.json ui/vite.config.ts ui/index.html ui/
COPY ui/src ui/src
COPY ui/public ui/public
RUN npm run build --workspace packages/contracts && npm run build --workspace ui

FROM caddy:2-alpine
COPY ui/Caddyfile /etc/caddy/Caddyfile
COPY --from=build /app/ui/dist /srv
EXPOSE 80
HEALTHCHECK --interval=15s --timeout=3s --retries=3 \
  CMD wget -qO- http://127.0.0.1/ >/dev/null || exit 1
