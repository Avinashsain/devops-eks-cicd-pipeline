# ---- Frontend Build Stage ----
FROM node:20-alpine AS frontend-builder

WORKDIR /frontend

COPY frontend/package*.json ./
RUN npm ci

COPY frontend/ ./
# vite.config.js sets build.outDir to '../public', so this lands at /public
RUN npm run build

# ---- Backend Build Stage ----
FROM node:20-alpine AS builder

# CVE-2026-45447 (libcrypto3/libssl3 heap use-after-free): pull the patched
# alpine package set (fixed in 3.5.7-r0) instead of whatever shipped with
# the base image layer.
RUN apk update && apk upgrade --no-cache

WORKDIR /app

COPY package*.json ./
RUN npm ci --omit=dev && npm cache clean --force

# ---- Runtime Stage ----
FROM node:20-alpine

# Same OS package upgrade in the runtime layer, since this is the image that
# actually ships — the builder stage's packages never reach production.
RUN apk update && apk upgrade --no-cache

RUN addgroup -S appgroup && adduser -S appuser -G appgroup

WORKDIR /app
ENV NODE_ENV=production

COPY --from=builder /app/node_modules ./node_modules
COPY . .
COPY --from=frontend-builder /public ./public

# CVE-2026-13149 / CVE-2026-14257 (brace-expansion), CVE-2024-21538
# (cross-spawn), CVE-2025-64756 (glob), CVE-2026-26996 / 27903 / 27904
# (minimatch), CVE-2026-48815 (sigstore), CVE-2026-59873 and friends (tar):
# every one of these is a transitive dependency of the *npm CLI itself*
# (usr/local/lib/node_modules/npm/node_modules/...), not of this app.
# The container only ever runs `node server.js`, so npm/npx/corepack/yarn
# have no reason to be in the shipped image — remove them and their
# vulnerable dependency trees entirely rather than trying to patch a tool
# that's never invoked.
RUN rm -rf \
      /usr/local/lib/node_modules/npm \
      /usr/local/lib/node_modules/corepack \
      /usr/local/bin/npm \
      /usr/local/bin/npx \
      /usr/local/bin/corepack \
      /opt/yarn-v1.22.22 \
      /usr/local/bin/yarn \
      /usr/local/bin/yarnpkg

RUN chown -R appuser:appgroup /app

USER appuser

# Green deployment runs on port 3009
EXPOSE 3009

# Health check
HEALTHCHECK --interval=30s --timeout=10s --start-period=10s --retries=3 \
  CMD wget -qO- http://localhost:3009/health || exit 1

CMD ["node", "server.js"]
