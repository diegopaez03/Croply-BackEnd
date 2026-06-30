# ──────────────────────────────────────────────────────────────────
#  Croply Backend — Dockerfile (Development)
#  Optimized for hot-reload with NestJS watch mode.
# ──────────────────────────────────────────────────────────────────

# ── Base image ────────────────────────────────────────────────────
FROM node:24.15.0-alpine AS base

# Install pnpm globally
RUN corepack enable && corepack prepare pnpm@latest --activate

WORKDIR /app

# ── Dependencies layer (cached) ───────────────────────────────────
FROM base AS deps
COPY package.json pnpm-lock.yaml* ./
RUN pnpm install --frozen-lockfile

# ── Development stage (hot-reload) ───────────────────────────────
FROM base AS development

WORKDIR /app

# Copy installed node_modules from deps stage
COPY --from=deps /app/node_modules ./node_modules

# Copy source code
COPY . .

# Expose application port
EXPOSE 3000

# Start NestJS in watch mode for hot-reload
CMD ["pnpm", "start:dev"]
