---
name: monorepo-typescript
description: TypeScript and JavaScript monorepo setup with pnpm, Nx, and Turborepo. Use for "TypeScript monorepo", "JavaScript monorepo", "pnpm workspace", "pnpm workspaces", "Nx workspace", "Turborepo", "Node.js monorepo", "React monorepo", "Next.js monorepo", "npm workspace", or "JavaScript multi-package".
---

# TypeScript/JavaScript Monorepo

Setup and manage TypeScript/JavaScript monorepos using pnpm workspaces (simple), Turborepo (task caching), or Nx (full-featured).

## Quick Navigation

- **pnpm Workspaces** → [references/pnpm-workspaces.md](references/pnpm-workspaces.md)
- **Turborepo** → [references/turborepo.md](references/turborepo.md)
- **Nx** → [references/nx.md](references/nx.md)
- **Docker Patterns** → [references/docker-node.md](references/docker-node.md)
- **Code Sharing & Publishing** → [references/code-sharing-patterns.md](references/code-sharing-patterns.md)

## Tool Selection

| Scale | Tool | Use When |
|-------|------|----------|
| 1-10 packages | pnpm workspaces | Simple setup, no caching needed |
| 10-50 packages | pnpm + Turborepo | Need task caching, minimal config |
| 50+ packages | Nx | Need generators, migrations, graph |

## pnpm Workspaces (Stage 1)

### Setup

```yaml
# pnpm-workspace.yaml
packages:
  - 'packages/*'
  - 'apps/*'

catalog:
  typescript: ^5.3.0
  react: ^18.2.0
  vite: ^5.0.0
```

**Root package.json:**

```json
{
  "name": "monorepo",
  "private": true,
  "packageManager": "pnpm@9.0.0",
  "scripts": {
    "build": "pnpm -r build",
    "test": "pnpm -r test",
    "dev": "pnpm --filter web dev"
  },
  "devDependencies": {
    "typescript": "catalog:"
  }
}
```

**Package package.json:**

```json
{
  "name": "@company/shared",
  "version": "1.0.0",
  "type": "module",
  "exports": {
    ".": {
      "types": "./dist/index.d.ts",
      "import": "./dist/index.js"
    }
  },
  "scripts": {
    "build": "tsc --build",
    "test": "vitest"
  },
  "devDependencies": {
    "typescript": "catalog:"
  }
}
```

**App with workspace dependency:**

```json
{
  "name": "@company/web",
  "dependencies": {
    "@company/shared": "workspace:*"
  }
}
```

### Essential Commands

```bash
# Install all dependencies
pnpm install

# Run command in all packages
pnpm -r build
pnpm -r test

# Run in specific package
pnpm --filter web dev
pnpm --filter @company/shared build

# Add dependency
pnpm --filter web add react

# Add workspace dependency
pnpm --filter web add @company/shared

# Upgrade dependencies
pnpm update -r
pnpm update -r typescript
```

## Turborepo (Stage 2)

Adds caching and affected-only execution to pnpm workspaces.

### Setup

```bash
pnpm add -D turbo
```

**turbo.json:**

```json
{
  "$schema": "https://turborepo.org/schema.json",
  "tasks": {
    "build": {
      "dependsOn": ["^build"],
      "outputs": ["dist/**", ".next/**"],
      "cache": true
    },
    "test": {
      "dependsOn": ["build"],
      "outputs": ["coverage/**"],
      "cache": true
    },
    "lint": {
      "outputs": [],
      "cache": true
    },
    "dev": {
      "cache": false,
      "persistent": true
    }
  },
  "globalDependencies": ["package.json", "pnpm-lock.yaml"]
}
```

### Essential Commands

```bash
# Build all packages
turbo build

# Build specific package
turbo build --filter=web

# Build affected only
turbo build --filter="[origin/main]"

# Build with dependencies
turbo build --filter=web --include-dependencies

# Test affected packages
turbo test --filter="[origin/main]"

# Dry run (show what would execute)
turbo build --dry
```

### Remote Caching (Vercel)

```bash
# Authenticate
turbo login

# Link project
turbo link

# Now builds are cached across CI/team
```

## Nx (Stage 3)

Full-featured with generators, migrations, and advanced graph.

### Setup

```bash
pnpm add -D nx
npx nx init
```

**nx.json:**

```json
{
  "version": 2,
  "extends": "nx/presets/npm.json",
  "targetDefaults": {
    "build": {
      "dependsOn": ["^build"],
      "cache": true,
      "outputs": ["{projectRoot}/dist"]
    },
    "test": {
      "dependsOn": ["build"],
      "cache": true,
      "outputs": ["{projectRoot}/coverage"]
    },
    "lint": {
      "cache": true
    }
  }
}
```

**project.json (per package):**

```json
{
  "name": "shared",
  "projectType": "library",
  "targets": {
    "build": {
      "executor": "@nx/js:tsc",
      "options": {
        "outputPath": "dist/packages/shared",
        "tsConfig": "packages/shared/tsconfig.lib.json"
      }
    },
    "test": {
      "executor": "@nx/jest:jest",
      "options": {
        "jestConfig": "packages/shared/jest.config.js"
      }
    }
  },
  "tags": ["type:lib", "scope:shared"]
}
```

### Essential Commands

```bash
# Run task on project
nx run web:build

# Run on multiple projects
nx run-many -t build --projects=web,api

# Run affected
nx affected -t test --base=origin/main

# Visualize graph
nx graph

# Generate library
nx generate @nx/js:library my-lib

# Connect to Nx Cloud
nx connect
```

## Directory Structure

```
monorepo/
├── package.json            # Root workspace
├── pnpm-workspace.yaml     # Workspace config
├── pnpm-lock.yaml
├── turbo.json              # Turborepo config (if using)
├── nx.json                 # Nx config (if using)
├── packages/
│   ├── shared/
│   │   ├── package.json
│   │   ├── tsconfig.json
│   │   └── src/
│   │       ├── index.ts
│   │       └── utils.ts
│   └── ui/
│       ├── package.json
│       └── src/
└── apps/
    ├── web/
    │   ├── package.json
    │   ├── next.config.js
    │   └── src/
    └── api/
        ├── package.json
        └── src/
```

## CI/CD Configuration

### GitHub Actions (Turborepo)

```yaml
name: CI
on: [push, pull_request]

env:
  TURBO_TOKEN: ${{ secrets.TURBO_TOKEN }}
  TURBO_TEAM: ${{ secrets.TURBO_TEAM }}

jobs:
  test:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
        with:
          fetch-depth: 0

      - uses: pnpm/action-setup@v3
        with:
          version: 9

      - uses: actions/setup-node@v4
        with:
          node-version: 20
          cache: 'pnpm'

      - run: pnpm install

      - name: Test affected
        run: turbo test --filter="[origin/main]"

      - name: Build affected
        run: turbo build --filter="[origin/main]"
```

### GitHub Actions (Nx)

```yaml
name: CI
on: [push, pull_request]

jobs:
  test:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
        with:
          fetch-depth: 0

      - uses: pnpm/action-setup@v3

      - uses: actions/setup-node@v4
        with:
          node-version: 20
          cache: 'pnpm'

      - run: pnpm install

      - name: Test affected
        run: npx nx affected -t test --base=origin/main
        env:
          NX_CLOUD_ACCESS_TOKEN: ${{ secrets.NX_CLOUD_TOKEN }}
```

## Docker Integration

### Multi-Stage Build

```dockerfile
FROM node:20-alpine AS builder
WORKDIR /app

# Install pnpm
RUN corepack enable pnpm

# Copy workspace files
COPY package.json pnpm-workspace.yaml pnpm-lock.yaml ./
COPY packages/shared/package.json ./packages/shared/
COPY apps/web/package.json ./apps/web/

# Install dependencies
RUN pnpm install --frozen-lockfile

# Copy source
COPY packages/shared ./packages/shared
COPY apps/web ./apps/web

# Build
RUN pnpm --filter @company/shared build
RUN pnpm --filter @company/web build

FROM node:20-alpine
WORKDIR /app

COPY --from=builder /app/apps/web/.next ./.next
COPY --from=builder /app/apps/web/public ./public
COPY --from=builder /app/apps/web/package.json ./

ENV NODE_ENV=production
CMD ["node", "server.js"]
```

## Common Patterns

### Adding New Package

```bash
mkdir -p packages/new-lib/src

cat > packages/new-lib/package.json << 'EOF'
{
  "name": "@company/new-lib",
  "version": "1.0.0",
  "type": "module",
  "main": "./dist/index.js",
  "types": "./dist/index.d.ts",
  "scripts": {
    "build": "tsc --build",
    "test": "vitest"
  },
  "devDependencies": {
    "typescript": "catalog:"
  }
}
EOF

pnpm install
```

### TypeScript Path Aliases

**tsconfig.json (root):**

```json
{
  "compilerOptions": {
    "baseUrl": ".",
    "paths": {
      "@company/shared": ["packages/shared/src"],
      "@company/ui": ["packages/ui/src"],
      "@company/*": ["packages/*/src"]
    }
  }
}
```

### Catalog Dependencies

```yaml
# pnpm-workspace.yaml
catalog:
  typescript: ^5.3.0
  react: ^18.2.0
  react-dom: ^18.2.0
  vite: ^5.0.0
  vitest: ^1.0.0
```

Use in package.json:

```json
{
  "dependencies": {
    "react": "catalog:"
  }
}
```

## Troubleshooting

| Issue | Solution |
|-------|----------|
| Package not found | Check pnpm-workspace.yaml globs |
| Workspace link broken | Use `workspace:*` protocol |
| Build order wrong | Add `dependsOn: ["^build"]` in turbo.json |
| Cache not hitting | Check `inputs` and `outputs` in turbo.json |
| Circular dependency | Use `nx graph` to visualize, refactor |
| TypeScript import errors | Check tsconfig paths and references |

## Comparison

| Feature | pnpm | Turborepo | Nx |
|---------|------|-----------|-----|
| Setup time | 5 min | 15 min | 30 min |
| Task caching | No | Yes | Yes |
| Remote cache | No | Vercel | Nx Cloud |
| Affected detection | No | Yes | Yes |
| Code generators | No | No | Yes |
| Migrations | No | No | Yes |
| IDE integration | Basic | Basic | Excellent |

## Further Reading

- [references/pnpm-workspaces.md](references/pnpm-workspaces.md) — Complete pnpm setup
- [references/turborepo.md](references/turborepo.md) — Turborepo configuration
- [references/nx.md](references/nx.md) — Nx generators and migrations
- [references/docker-node.md](references/docker-node.md) — Production Docker patterns
- [references/code-sharing-patterns.md](references/code-sharing-patterns.md) — Shared configs, component libraries, changesets
