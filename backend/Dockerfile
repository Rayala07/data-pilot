# syntax=docker/dockerfile:1
#
# Multi-stage build for the DataPilot backend.
#
# This exists to do properly what Render's native Node runtime cannot: separate
# the build environment from the runtime one. `typescript` and the `prisma` CLI
# are devDependencies — needed to compile and to generate the client, never
# loaded by the running server. Here they stay in the builder and never reach
# the final image.
#
# Build context is this directory (backend/), not the repo root.
#   docker build -t datapilot-backend .
#
# Three details drive the layout:
#   1. `bcrypt` is a native module: it needs python3/make/g++ to compile, and it
#      must be compiled against the same libc as the runtime — hence every stage
#      shares one base image.
#   2. Prisma's query engine needs `openssl` at runtime, not just at build.
#   3. The generated Prisma client lives in node_modules/.prisma, which
#      `prisma generate` creates and `npm install` does not. A production-only
#      install cannot produce it, so it is copied from the builder.

ARG NODE_VERSION=22-bookworm-slim

# ---------------------------------------------------------------------------
# base — the one image every stage shares, so native builds stay ABI-compatible
# ---------------------------------------------------------------------------
FROM node:${NODE_VERSION} AS base
WORKDIR /app
ENV NPM_CONFIG_UPDATE_NOTIFIER=false \
    NPM_CONFIG_FUND=false
# openssl: required by Prisma's query engine at run time.
RUN apt-get update \
 && apt-get install -y --no-install-recommends openssl ca-certificates \
 && rm -rf /var/lib/apt/lists/*

# Toolchain for compiling bcrypt. Only the two install stages need it.
FROM base AS toolchain
RUN apt-get update \
 && apt-get install -y --no-install-recommends python3 make g++ \
 && rm -rf /var/lib/apt/lists/*

# ---------------------------------------------------------------------------
# builder — full dependency tree: compiles TypeScript, generates Prisma client
# ---------------------------------------------------------------------------
FROM toolchain AS builder

# Copy manifests first so `npm ci` is cached until a dependency actually changes.
COPY package.json package-lock.json ./
# --include=dev is explicit: npm omits devDependencies whenever NODE_ENV is
# "production", and this image sets that for the runtime stage.
RUN npm ci --include=dev

# schema.prisma must exist before `prisma generate` runs.
COPY prisma ./prisma
RUN npx prisma generate

COPY tsconfig.json ./
COPY src ./src
RUN npm run build

# ---------------------------------------------------------------------------
# prod-deps — runtime dependency tree only (no tsc, no prisma CLI, no @types)
# ---------------------------------------------------------------------------
FROM toolchain AS prod-deps
COPY package.json package-lock.json ./
# @prisma/client's postinstall wants the prisma CLI, which isn't here. It skips
# with a warning; the generated client is copied from the builder below.
RUN npm ci --omit=dev

# ---------------------------------------------------------------------------
# runner — what actually ships
# ---------------------------------------------------------------------------
FROM base AS runner

ENV NODE_ENV=production

COPY --from=prod-deps /app/node_modules ./node_modules

# The generated client: `prisma generate` writes it, `npm ci` cannot reproduce
# it, so it must come across from the builder.
COPY --from=builder /app/node_modules/.prisma ./node_modules/.prisma
COPY --from=builder /app/node_modules/@prisma/client ./node_modules/@prisma/client

# Prisma CLI + schema, so `prisma migrate deploy` can run as a pre-deploy step
# inside this image. ~70 MB. If you apply migrations from somewhere else, delete
# these two COPY lines and the `prisma/` copy below.
COPY --from=builder /app/node_modules/prisma ./node_modules/prisma
COPY prisma ./prisma

COPY --from=builder /app/dist ./dist
COPY package.json ./

# Drop root. The app writes nothing to disk.
USER node

# Documentation only: the platform injects PORT, and the server reads it.
EXPOSE 4000

# Node 22 has a global fetch, so no curl/wget needs installing.
HEALTHCHECK --interval=30s --timeout=3s --start-period=15s --retries=3 \
  CMD node -e "fetch('http://127.0.0.1:'+(process.env.PORT||4000)+'/health').then(r=>process.exit(r.ok?0:1)).catch(()=>process.exit(1))"

# Migrations are deliberately NOT run here. Starting a container should not
# mutate a shared database — with more than one instance they would race.
# Run them as a pre-deploy step:
#   node node_modules/prisma/build/index.js migrate deploy
CMD ["node", "dist/index.js"]
