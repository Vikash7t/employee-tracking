# ==============================================================================
# Enterprise Multi-Stage Dockerfile: NestJS + PostGIS Backend
# Hardened for CIS Benchmark Compliance (Non-Root User, dumb-init PID 1)
# ==============================================================================

# Stage 1: Base image with system utilities & OpenSSL for Prisma
FROM node:20-bookworm-slim AS base
RUN apt-get update && apt-get install -y --no-install-recommends \
    dumb-init \
    openssl \
    ca-certificates \
    && rm -rf /var/lib/apt/lists/*
WORKDIR /app

# Stage 2: Install dependencies across monorepo workspaces
FROM base AS dependencies
COPY package.json package-lock.json ./
COPY packages/contracts/package.json ./packages/contracts/
COPY apps/backend/package.json ./apps/backend/
RUN npm ci

# Stage 3: Build contracts, generate Prisma client, and compile NestJS
FROM dependencies AS builder
COPY packages/contracts ./packages/contracts
RUN npm run build --workspace=@employee-tracking/contracts

COPY apps/backend ./apps/backend
RUN npx prisma generate --schema=apps/backend/prisma/schema.prisma
RUN npm run build --workspace=@employee-tracking/backend

# Stage 4: Production Runtime Container
FROM base AS runner
ENV NODE_ENV=production
ENV PORT=4000

# Copy root manifests & production-only node_modules
COPY package.json package-lock.json ./
COPY packages/contracts/package.json ./packages/contracts/
COPY apps/backend/package.json ./apps/backend/
RUN npm ci --omit=dev

# Copy compiled artifacts from builder
COPY --from=builder /app/packages/contracts/dist ./packages/contracts/dist
COPY --from=builder /app/apps/backend/dist ./apps/backend/dist
COPY --from=builder /app/apps/backend/prisma ./apps/backend/prisma
COPY --from=builder /app/node_modules/.prisma ./node_modules/.prisma
COPY --from=builder /app/node_modules/@prisma ./node_modules/@prisma

# Security: Enforce unprivileged execution (CIS Docker Benchmark 4.1)
USER node:node

EXPOSE 4000

# Container liveness health check
HEALTHCHECK --interval=30s --timeout=5s --start-period=10s --retries=3 \
  CMD node -e "require('http').get('http://localhost:4000/api/v1/health/liveness', (r) => process.exit(r.statusCode === 200 ? 0 : 1))"

ENTRYPOINT ["dumb-init", "--"]
CMD ["node", "apps/backend/dist/main.js"]
