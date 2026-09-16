# syntax=docker/dockerfile:1
# Build context is the repository root: the API depends on the workspace package in packages/contracts.

FROM node:26-alpine AS base
WORKDIR /app
COPY package.json package-lock.json ./
COPY packages/contracts/package.json packages/contracts/
COPY api/package.json api/
COPY ui/package.json ui/

FROM base AS deps
RUN npm ci --workspace api --workspace packages/contracts --no-audit --no-fund

FROM deps AS build
COPY tsconfig.base.json ./
COPY packages/contracts/tsconfig.json packages/contracts/
COPY packages/contracts/src packages/contracts/src
COPY api/tsconfig.json api/tsconfig.build.json api/nest-cli.json api/
COPY api/src api/src
RUN npm run build --workspace packages/contracts && npm run build --workspace api

FROM base AS prod-deps
RUN npm ci --workspace api --workspace packages/contracts --omit=dev --no-audit --no-fund \
  && npm cache clean --force \
  && mkdir -p api/node_modules

FROM node:26-alpine AS runtime
ENV NODE_ENV=production \
    PORT=3288
WORKDIR /app
COPY --chown=node:node package.json ./
COPY --from=prod-deps --chown=node:node /app/node_modules ./node_modules
COPY --from=prod-deps --chown=node:node /app/api/node_modules ./api/node_modules
COPY --chown=node:node packages/contracts/package.json packages/contracts/
COPY --from=build --chown=node:node /app/packages/contracts/dist packages/contracts/dist
COPY --chown=node:node api/package.json api/
COPY --from=build --chown=node:node /app/api/dist api/dist
WORKDIR /app/api
# SQLite database; mounted as a volume by docker compose
RUN mkdir -p data && chown node:node data
USER node
EXPOSE 3288
HEALTHCHECK --interval=15s --timeout=3s --start-period=10s --retries=3 \
  CMD wget -qO- "http://127.0.0.1:${PORT}/health" || exit 1
CMD ["node", "dist/main.js"]
