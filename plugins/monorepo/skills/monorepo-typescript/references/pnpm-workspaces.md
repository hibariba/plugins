# Stage 2: Polyglot Monorepo (uv + pnpm)

## Overview

Combines Python (uv) and TypeScript (pnpm) as parallel, independent toolchains with external task coordination.

**Use when:**
- Backend (Python) + Frontend (TypeScript) services
- < 20 total packages
- CI < 10 minutes
- No native cross-language imports needed

## Architecture

```
monorepo/
├── pyproject.toml              # Python workspace (uv)
├── uv.lock
├── package.json                # TypeScript workspace root
├── pnpm-workspace.yaml
├── pnpm-lock.yaml
├── libs/
│   ├── shared-py/              # Python library
│   │   ├── pyproject.toml
│   │   └── src/
│   └── shared-ts/              # TypeScript library
│       ├── package.json
│       ├── tsconfig.json
│       └── src/
├── services/
│   └── api/                    # Python backend
│       ├── pyproject.toml
│       └── src/
└── apps/
    └── web/                    # TypeScript frontend
        ├── package.json
        └── src/
```

## Setup

### 1. Initialize Both Workspaces

**Python (uv):**
```toml
# pyproject.toml
[project]
name = "monorepo"
version = "0.1.0"
requires-python = ">=3.12"

[tool.uv.workspace]
members = ["libs/shared-py", "services/*"]

[build-system]
requires = ["uv_build>=0.9.28"]
build-backend = "uv_build"
```

**TypeScript (pnpm):**
```yaml
# pnpm-workspace.yaml
packages:
  - 'libs/shared-ts'
  - 'apps/*'
  - 'packages/*'

catalog:
  typescript: ^5.3.0
  react: ^18.2.0
  vite: ^5.0.0
```

```json
// package.json
{
  "name": "monorepo",
  "version": "0.1.0",
  "private": true,
  "scripts": {
    "dev": "pnpm --filter web dev",
    "build": "pnpm --recursive build",
    "test": "pnpm --recursive test"
  },
  "devDependencies": {
    "typescript": "catalog:",
    "prettier": "^3.1.0"
  }
}
```

### 2. Configure TypeScript Packages

**libs/shared-ts/package.json:**
```json
{
  "name": "@monorepo/shared",
  "version": "0.1.0",
  "type": "module",
  "main": "./dist/index.js",
  "types": "./dist/index.d.ts",
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
  "dependencies": {
    "zod": "^3.22.0"
  },
  "devDependencies": {
    "typescript": "catalog:",
    "vitest": "^1.0.0"
  }
}
```

**apps/web/package.json:**
```json
{
  "name": "@monorepo/web",
  "version": "0.1.0",
  "type": "module",
  "scripts": {
    "dev": "vite",
    "build": "tsc && vite build",
    "preview": "vite preview"
  },
  "dependencies": {
    "@monorepo/shared": "workspace:*",
    "react": "catalog:",
    "react-dom": "catalog:"
  },
  "devDependencies": {
    "vite": "catalog:",
    "typescript": "catalog:"
  }
}
```

## Task Coordination

**No native integration** between uv and pnpm. Use external tools:

### Option 1: Root package.json Scripts

```json
{
  "scripts": {
    "install:all": "uv sync --all-packages && pnpm install",
    "dev:api": "uv run --package api python -m api.main",
    "dev:web": "pnpm --filter web dev",
    "dev": "concurrently 'npm:dev:api' 'npm:dev:web'",
    "test:py": "uv run pytest",
    "test:ts": "pnpm --recursive test",
    "test": "npm run test:py && npm run test:ts",
    "build:api": "uv build --package api",
    "build:web": "pnpm --filter web build",
    "build": "npm run build:api && npm run build:web"
  },
  "devDependencies": {
    "concurrently": "^8.2.0"
  }
}
```

### Option 2: Justfile (Recommended)

```justfile
# justfile
default:
  @just --list

# Install all dependencies
install:
  uv sync --all-packages
  pnpm install

# Run development servers
dev:
  just dev-api & just dev-web

dev-api:
  uv run --package api python -m api.main

dev-web:
  pnpm --filter web dev

# Run all tests
test:
  just test-py
  just test-ts

test-py:
  uv run pytest

test-ts:
  pnpm --recursive test

# Build all packages
build:
  uv build --package api
  pnpm --recursive build

# Format code
fmt:
  uv run ruff format .
  pnpm exec prettier --write .

# Lint code
lint:
  uv run ruff check .
  uv run mypy .
  pnpm exec eslint .
```

### Option 3: Mise Tasks

```toml
# .mise.toml
[tasks.install]
run = ["uv sync --all-packages", "pnpm install"]

[tasks.dev]
run = "mise run dev:api & mise run dev:web"

[tasks."dev:api"]
run = "uv run --package api python -m api.main"

[tasks."dev:web"]
run = "pnpm --filter web dev"

[tasks.test]
run = ["mise run test:py", "mise run test:ts"]

[tasks."test:py"]
run = "uv run pytest"

[tasks."test:ts"]
run = "pnpm --recursive test"
```

## Cross-Language Coordination

### API Contracts

**Option 1: OpenAPI Schema**
```python
# services/api/src/api/main.py
from fastapi import FastAPI
from pydantic import BaseModel

app = FastAPI()

@app.get("/api/schema.json")
def get_schema():
    return app.openapi()
```

Generate TypeScript types:
```bash
# Generate from running API
pnpm add -D openapi-typescript
pnpm exec openapi-typescript http://localhost:8000/api/schema.json -o libs/shared-ts/src/api-types.ts
```

**Option 2: Shared JSON Schema**
```
libs/
├── schemas/              # Language-agnostic schemas
│   ├── user.json
│   └── product.json
├── shared-py/
│   └── src/
│       └── models.py     # Generated from schemas
└── shared-ts/
    └── src/
        └── types.ts      # Generated from schemas
```

### Shared Data Files

```
shared/
├── config/
│   ├── environments.json
│   └── feature-flags.json
└── i18n/
    ├── en.json
    └── es.json
```

Both toolchains can import JSON directly.

## CI/CD Configuration

```yaml
# .github/workflows/ci.yml
name: CI

on: [push, pull_request]

jobs:
  python-tests:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4

      - name: Install uv
        uses: astral-sh/setup-uv@v3

      - name: Set up Python
        uses: actions/setup-python@v5
        with:
          python-version: "3.12"

      - name: Install Python dependencies
        run: uv sync --all-packages

      - name: Run Python tests
        run: uv run pytest

      - name: Run Python linting
        run: |
          uv run ruff check .
          uv run mypy .

  typescript-tests:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4

      - uses: pnpm/action-setup@v3
        with:
          version: 9

      - uses: actions/setup-node@v4
        with:
          node-version: 20
          cache: 'pnpm'

      - name: Install TypeScript dependencies
        run: pnpm install

      - name: Run TypeScript tests
        run: pnpm --recursive test

      - name: Run TypeScript linting
        run: pnpm exec eslint .

      - name: Type check
        run: pnpm --recursive exec tsc --noEmit

  build:
    needs: [python-tests, typescript-tests]
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4

      - name: Install uv
        uses: astral-sh/setup-uv@v3

      - uses: pnpm/action-setup@v3
        with:
          version: 9

      - uses: actions/setup-node@v4
        with:
          node-version: 20
          cache: 'pnpm'

      - name: Install all dependencies
        run: |
          uv sync --all-packages
          pnpm install

      - name: Build all packages
        run: |
          uv build --package api
          pnpm --recursive build
```

## Docker Compose

```yaml
# docker-compose.yml
version: '3.8'

services:
  api:
    build:
      context: .
      dockerfile: services/api/Dockerfile
    ports:
      - "8000:8000"
    environment:
      - DATABASE_URL=postgresql://db:5432/app
    depends_on:
      - db

  web:
    build:
      context: .
      dockerfile: apps/web/Dockerfile
    ports:
      - "3000:3000"
    environment:
      - API_URL=http://api:8000

  db:
    image: postgres:16
    environment:
      - POSTGRES_DB=app
      - POSTGRES_PASSWORD=secret
    volumes:
      - postgres_data:/var/lib/postgresql/data

volumes:
  postgres_data:
```

## Common Commands

```bash
# Install everything
uv sync --all-packages && pnpm install

# Development
just dev                          # Both servers
uv run --package api python -m api.main    # API only
pnpm --filter web dev             # Web only

# Testing
uv run pytest                     # Python tests
pnpm --recursive test             # TypeScript tests

# Building
uv build --package api            # Python package
pnpm --filter web build           # Web app

# Adding dependencies
cd services/api && uv add httpx   # Python dep
pnpm --filter web add axios       # TypeScript dep

# Workspace dependencies
cd apps/web
pnpm add @monorepo/shared         # Links workspace package
```

## Troubleshooting

| Issue | Solution |
|-------|----------|
| pnpm not finding packages | Check pnpm-workspace.yaml globs |
| Workspace packages not linked | Use `workspace:*` protocol in package.json |
| Both toolchains slow in CI | Cache uv and pnpm separately |
| Lockfile conflicts | Run `uv lock` and `pnpm install` separately |
| TypeScript can't import Python | Share via API contracts, not direct imports |

## Migration to Stage 3

When to migrate:
- CI > 10 minutes
- Need unified task orchestration
- File-level dependency tracking
- > 20 total packages

**Options:**
- **Pants**: Best for Python-heavy with some TypeScript
- **Nx**: Best for TypeScript-heavy with some Python
- **Bazel**: Best for true polyglot equality

See [migration-stages.md](migration-stages.md) for upgrade paths.

## Resources

- pnpm workspaces: https://pnpm.io/workspaces
- pnpm catalog: https://pnpm.io/catalogs
- just: https://just.systems/
- mise: https://mise.jdx.dev/
