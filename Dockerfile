# syntax=docker/dockerfile:1
# Croply backend — NestJS
#   docker compose  → target development (watch)
#   deploy          → target production  (node dist/main)

FROM node:22-alpine AS base
RUN corepack enable && corepack prepare pnpm@12.4.1 --activate
WORKDIR /app

# Dependencias (capa cacheable). bcrypt necesita toolchain en Alpine.
FROM base AS deps
RUN apk add --no-cache python3 make g++ libc6-compat
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml .npmrc ./
RUN --mount=type=cache,id=croply-be-pnpm,target=/root/.local/share/pnpm/store \
    pnpm install --frozen-lockfile

# ── Desarrollo (compose) ──────────────────────────────────────────
FROM base AS development
ENV NODE_ENV=development \
    CI=true \
    CHOKIDAR_USEPOLLING=true \
    CHOKIDAR_INTERVAL=300
COPY --from=deps /app/node_modules ./node_modules
COPY package.json pnpm-lock.yaml .npmrc ./
EXPOSE 3000
CMD ["./node_modules/.bin/nest", "start", "--watch"]

# ── Producción ────────────────────────────────────────────────────
FROM deps AS build
COPY . .
RUN pnpm build && pnpm prune --prod

FROM node:22-alpine AS production
ENV NODE_ENV=production
RUN addgroup -S croply && adduser -S croply -G croply
WORKDIR /app
COPY --from=build --chown=croply:croply /app/node_modules ./node_modules
COPY --from=build --chown=croply:croply /app/dist ./dist
COPY --from=build --chown=croply:croply /app/package.json ./
USER croply
EXPOSE 3000
CMD ["node", "dist/main.js"]
