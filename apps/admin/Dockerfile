# ==============================================================================
# Enterprise Multi-Stage Dockerfile: Next.js 15 Standalone Command Center
# Hardened for CIS Benchmark Compliance (Non-Root User, Minimal Standalone Layer)
# ==============================================================================

# Stage 1: Base image
FROM node:20-bookworm-slim AS base
RUN apt-get update && apt-get install -y --no-install-recommends \
    dumb-init \
    ca-certificates \
    && rm -rf /var/lib/apt/lists/*
WORKDIR /app

# Stage 2: Install dependencies
FROM base AS dependencies
COPY package.json package-lock.json ./
COPY packages/contracts/package.json ./packages/contracts/
COPY apps/admin/package.json ./apps/admin/
RUN npm ci

# Stage 3: Build shared contracts & Next.js standalone application
FROM dependencies AS builder
ENV NEXT_TELEMETRY_DISABLED=1

COPY packages/contracts ./packages/contracts
RUN npm run build --workspace=@employee-tracking/contracts

COPY apps/admin ./apps/admin
RUN npm run build --workspace=@employee-tracking/admin

# Stage 4: Minimal Production Standalone Runner (~120MB)
FROM base AS runner
ENV NODE_ENV=production
ENV PORT=3000
ENV HOSTNAME="0.0.0.0"
ENV NEXT_TELEMETRY_DISABLED=1

# Copy standalone build bundle & static assets
COPY --from=builder --chown=node:node /app/apps/admin/.next/standalone ./
COPY --from=builder --chown=node:node /app/apps/admin/.next/static ./apps/admin/.next/static

# Security: Enforce unprivileged execution (CIS Docker Benchmark 4.1)
USER node:node

EXPOSE 3000

# Container liveness health check
HEALTHCHECK --interval=30s --timeout=5s --start-period=10s --retries=3 \
  CMD node -e "require('http').get('http://localhost:3000', (r) => process.exit(r.statusCode < 500 ? 0 : 1))"

ENTRYPOINT ["dumb-init", "--"]
CMD ["node", "apps/admin/server.js"]
