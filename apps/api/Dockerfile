# syntax=docker/dockerfile:1
# Build context: repo root (xem docker-compose.yml và .github/workflows/ci.yml)
FROM node:22-alpine AS base
RUN apk add --no-cache openssl
RUN npm install -g pnpm@12.14.0
WORKDIR /repo

FROM base AS prod-deps
COPY package.json pnpm-workspace.yaml pnpm-lock.yaml .npmrc ./
COPY apps/api/package.json apps/api/
COPY apps/web/package.json apps/web/
RUN pnpm install --frozen-lockfile --prod --filter @brewlite/api...
COPY apps/api/prisma apps/api/prisma
RUN pnpm --filter @brewlite/api exec prisma generate

FROM base AS builder
COPY package.json pnpm-workspace.yaml pnpm-lock.yaml .npmrc ./
COPY apps/api/package.json apps/api/
COPY apps/web/package.json apps/web/
RUN pnpm install --frozen-lockfile --filter @brewlite/api...
COPY apps/api apps/api
RUN pnpm --filter @brewlite/api exec prisma generate
RUN pnpm --filter @brewlite/api build

FROM node:22-alpine AS runner
RUN apk add --no-cache openssl
ENV NODE_ENV=production
ENV PORT=3000
WORKDIR /app
COPY --from=prod-deps --chown=node:node /repo/node_modules ./node_modules
COPY --from=prod-deps --chown=node:node /repo/apps/api/node_modules ./apps/api/node_modules
COPY --from=builder --chown=node:node /repo/apps/api/dist ./apps/api/dist
COPY --from=builder --chown=node:node /repo/apps/api/prisma ./apps/api/prisma
COPY --chown=node:node apps/api/docker-entrypoint.sh ./docker-entrypoint.sh
RUN chmod +x ./docker-entrypoint.sh
USER node
EXPOSE 3000
HEALTHCHECK --interval=30s --timeout=5s --start-period=20s --retries=3 \
  CMD wget -qO- "http://127.0.0.1:${PORT}/health" > /dev/null || exit 1
ENTRYPOINT ["./docker-entrypoint.sh"]
