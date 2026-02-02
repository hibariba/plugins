# Docker Patterns for Node.js/TypeScript Monorepos

Production-ready Docker patterns for TypeScript and JavaScript monorepos.

## Multi-Stage Build (pnpm)

```dockerfile
# syntax=docker/dockerfile:1

FROM node:20-alpine AS base
RUN corepack enable pnpm

# Dependencies stage
FROM base AS deps
WORKDIR /app

# Copy workspace configuration
COPY package.json pnpm-workspace.yaml pnpm-lock.yaml ./

# Copy all package.json files
COPY packages/shared/package.json ./packages/shared/
COPY packages/ui/package.json ./packages/ui/
COPY apps/web/package.json ./apps/web/

# Install dependencies
RUN --mount=type=cache,id=pnpm,target=/root/.local/share/pnpm/store \
    pnpm install --frozen-lockfile

# Builder stage
FROM base AS builder
WORKDIR /app

COPY --from=deps /app/node_modules ./node_modules
COPY --from=deps /app/packages/shared/node_modules ./packages/shared/node_modules
COPY --from=deps /app/packages/ui/node_modules ./packages/ui/node_modules
COPY --from=deps /app/apps/web/node_modules ./apps/web/node_modules

# Copy source code
COPY packages/shared ./packages/shared
COPY packages/ui ./packages/ui
COPY apps/web ./apps/web
COPY tsconfig.json ./

# Build in dependency order
RUN pnpm --filter @company/shared build
RUN pnpm --filter @company/ui build
RUN pnpm --filter @company/web build

# Production stage
FROM node:20-alpine AS runner
WORKDIR /app

ENV NODE_ENV=production

# Copy built application
COPY --from=builder /app/apps/web/.next/standalone ./
COPY --from=builder /app/apps/web/.next/static ./.next/static
COPY --from=builder /app/apps/web/public ./public

EXPOSE 3000
CMD ["node", "server.js"]
```

## Next.js Standalone Build

```dockerfile
FROM node:20-alpine AS base

FROM base AS deps
WORKDIR /app

RUN corepack enable pnpm

COPY package.json pnpm-workspace.yaml pnpm-lock.yaml ./
COPY apps/web/package.json ./apps/web/
COPY packages/shared/package.json ./packages/shared/

RUN --mount=type=cache,id=pnpm,target=/root/.local/share/pnpm/store \
    pnpm install --frozen-lockfile --prod=false

FROM base AS builder
WORKDIR /app

COPY --from=deps /app ./
COPY packages/shared ./packages/shared
COPY apps/web ./apps/web

# Build workspace dependency first
WORKDIR /app/packages/shared
RUN npm run build

# Build Next.js app with standalone output
WORKDIR /app/apps/web
ENV NEXT_TELEMETRY_DISABLED=1
RUN npm run build

FROM base AS runner
WORKDIR /app

ENV NODE_ENV=production
ENV NEXT_TELEMETRY_DISABLED=1

RUN addgroup --system --gid 1001 nodejs
RUN adduser --system --uid 1001 nextjs

COPY --from=builder /app/apps/web/public ./public
COPY --from=builder --chown=nextjs:nodejs /app/apps/web/.next/standalone ./
COPY --from=builder --chown=nextjs:nodejs /app/apps/web/.next/static ./.next/static

USER nextjs

EXPOSE 3000
ENV PORT=3000
ENV HOSTNAME="0.0.0.0"

CMD ["node", "server.js"]
```

## Turbo Prune (Optimized)

Turborepo's `prune` command creates minimal workspaces for Docker:

```bash
# Generate pruned workspace for specific package
turbo prune @company/web --docker
```

```dockerfile
FROM node:20-alpine AS base
RUN corepack enable pnpm

# Pruned dependencies
FROM base AS pruner
WORKDIR /app

COPY . .
RUN npx turbo prune @company/web --docker

# Install dependencies
FROM base AS deps
WORKDIR /app

COPY --from=pruner /app/out/json/ .
COPY --from=pruner /app/out/pnpm-lock.yaml ./pnpm-lock.yaml

RUN --mount=type=cache,id=pnpm,target=/root/.local/share/pnpm/store \
    pnpm install --frozen-lockfile

# Build
FROM base AS builder
WORKDIR /app

COPY --from=deps /app/ ./
COPY --from=pruner /app/out/full/ ./

RUN pnpm turbo build --filter=@company/web

# Run
FROM node:20-alpine AS runner
WORKDIR /app

COPY --from=builder /app/apps/web/.next/standalone ./
COPY --from=builder /app/apps/web/.next/static ./.next/static
COPY --from=builder /app/apps/web/public ./public

CMD ["node", "server.js"]
```

## API Service (Express/Fastify)

```dockerfile
FROM node:20-alpine AS base
RUN corepack enable pnpm

FROM base AS deps
WORKDIR /app

COPY package.json pnpm-workspace.yaml pnpm-lock.yaml ./
COPY packages/shared/package.json ./packages/shared/
COPY apps/api/package.json ./apps/api/

RUN --mount=type=cache,id=pnpm,target=/root/.local/share/pnpm/store \
    pnpm install --frozen-lockfile

FROM base AS builder
WORKDIR /app

COPY --from=deps /app ./
COPY packages/shared ./packages/shared
COPY apps/api ./apps/api
COPY tsconfig.json ./

RUN pnpm --filter @company/shared build
RUN pnpm --filter @company/api build

FROM base AS production-deps
WORKDIR /app

COPY package.json pnpm-workspace.yaml pnpm-lock.yaml ./
COPY packages/shared/package.json ./packages/shared/
COPY apps/api/package.json ./apps/api/

RUN --mount=type=cache,id=pnpm,target=/root/.local/share/pnpm/store \
    pnpm install --frozen-lockfile --prod

FROM node:20-alpine AS runner
WORKDIR /app

ENV NODE_ENV=production

# Copy production dependencies
COPY --from=production-deps /app/node_modules ./node_modules
COPY --from=production-deps /app/apps/api/node_modules ./apps/api/node_modules

# Copy built code
COPY --from=builder /app/packages/shared/dist ./packages/shared/dist
COPY --from=builder /app/apps/api/dist ./apps/api/dist

WORKDIR /app/apps/api

EXPOSE 3000
CMD ["node", "dist/main.js"]
```

## Docker Compose

```yaml
version: '3.8'

services:
  web:
    build:
      context: .
      dockerfile: apps/web/Dockerfile
    ports:
      - "3000:3000"
    environment:
      - API_URL=http://api:4000
    depends_on:
      - api

  api:
    build:
      context: .
      dockerfile: apps/api/Dockerfile
    ports:
      - "4000:4000"
    environment:
      - DATABASE_URL=postgresql://postgres:password@db:5432/app
    depends_on:
      - db

  db:
    image: postgres:16-alpine
    environment:
      - POSTGRES_USER=postgres
      - POSTGRES_PASSWORD=password
      - POSTGRES_DB=app
    volumes:
      - postgres_data:/var/lib/postgresql/data

volumes:
  postgres_data:
```

## Build Optimization Tips

### 1. Order COPY Commands by Change Frequency

```dockerfile
# Least likely to change first
COPY package.json pnpm-workspace.yaml pnpm-lock.yaml ./

# Package manifests (rarely change)
COPY packages/*/package.json ./packages/

# Configuration (occasionally changes)
COPY tsconfig*.json ./

# Source code (frequently changes)
COPY packages/ ./packages/
COPY apps/ ./apps/
```

### 2. Use BuildKit Cache Mounts

```dockerfile
RUN --mount=type=cache,id=pnpm,target=/root/.local/share/pnpm/store \
    pnpm install --frozen-lockfile
```

### 3. Multi-Platform Builds

```bash
docker buildx build \
  --platform linux/amd64,linux/arm64 \
  -t myapp:latest \
  --push .
```

### 4. Production Dependencies Only

```dockerfile
# Separate stage for production deps
FROM base AS production-deps
RUN pnpm install --frozen-lockfile --prod

# Copy only production deps to final image
COPY --from=production-deps /app/node_modules ./node_modules
```

## GitHub Actions + Docker

```yaml
name: Build and Push

on:
  push:
    branches: [main]

jobs:
  build:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4

      - name: Set up Docker Buildx
        uses: docker/setup-buildx-action@v3

      - name: Login to Container Registry
        uses: docker/login-action@v3
        with:
          registry: ghcr.io
          username: ${{ github.actor }}
          password: ${{ secrets.GITHUB_TOKEN }}

      - name: Build and push
        uses: docker/build-push-action@v5
        with:
          context: .
          file: apps/web/Dockerfile
          push: true
          tags: ghcr.io/${{ github.repository }}/web:latest
          cache-from: type=gha
          cache-to: type=gha,mode=max
```

## Resources

- Docker BuildKit: https://docs.docker.com/build/buildkit/
- Turborepo Docker: https://turbo.build/repo/docs/guides/tools/docker
- Next.js Docker: https://nextjs.org/docs/deployment#docker-image
