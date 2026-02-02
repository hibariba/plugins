# Docker and CI/CD Patterns for uv Monorepos

Production-grade Docker and continuous integration patterns for Python monorepos using uv. This guide focuses on optimization, caching, and security for build times and deployment pipelines.

## Table of Contents

- [Overview and Best Practices](#overview-and-best-practices)
- [BuildKit Optimization](#buildkit-optimization)
- [Multi-Stage Build Patterns](#multi-stage-build-patterns)
- [Official uv Base Images](#official-uv-base-images)
- [uv-Managed Python](#uv-managed-python)
- [Non-Root User Setup](#non-root-user-setup)
- [Development Workflows](#development-workflows)
- [CI/CD Integration](#cicd-integration)
- [Serverless Deployment](#serverless-deployment)
- [Workspace-Specific Builds](#workspace-specific-builds)
- [Performance Benchmarks](#performance-benchmarks)
- [Troubleshooting](#troubleshooting)
- [Resources](#resources)

---

## Overview and Best Practices

### Why uv in Docker?

**Speed**: uv's Rust implementation is significantly faster than pip:
- 2-3x faster dependency resolution
- 4-5x faster lockfile updates
- Instant project initialization

**Reproducibility**: Frozen lockfiles (`uv.lock`) ensure identical environments across development, testing, and production.

**Monorepo Support**: Native workspace handling simplifies building and deploying specific packages.

### Core Principles

1. **Cache Everything**: BuildKit cache mounts can reduce rebuild times from minutes to seconds
2. **Multi-Stage Builds**: Separate build dependencies from runtime, cutting final image size 50-70%
3. **Link Mode Management**: `UV_LINK_MODE=copy` enables Docker layer caching
4. **Bytecode Compilation**: Pre-compile Python for faster startup times
5. **Security First**: Always use non-root users and minimal base images
6. **Dependency Layer Priority**: Copy `pyproject.toml` and `uv.lock` before application code

### Docker .dockerignore Reference

```dockerignore
# Python
__pycache__/
*.pyc
*.pyo
*.pyd
.Python
.venv/
venv/
env/

# Version control
.git/
.gitignore
.gitattributes

# Development
.vscode/
.idea/
*.swp
*.swo
.DS_Store

# CI/CD
.github/
.gitlab-ci.yml

# Build artifacts
dist/
build/
*.egg-info/

# Environment
.env
.env.local
.env*.local
```

---

## BuildKit Optimization

BuildKit is Docker's modern build engine with powerful caching. Enable it:

```bash
export DOCKER_BUILDKIT=1
```

Or permanently in Docker daemon config:

```json
{
  "features": {
    "buildkit": true
  }
}
```

### Cache Mounts: The Game Changer

BuildKit cache mounts can reduce rebuild times from minutes to seconds by persisting the uv cache between builds.

**Without cache mounts** (typical rebuild):
```
Step 1 : RUN uv sync --frozen
  Resolving dependencies...     [████████████████] 120s
  Installing packages...        [████████████████] 45s
  Total time: 165 seconds
```

**With cache mounts** (incremental rebuild):
```
Step 1 : RUN --mount=type=cache,target=/root/.cache/uv uv sync --frozen
  Using cache...
  Resolving dependencies...     [████████████] 2s
  Installing packages...        [████████████] 8s
  Total time: 10 seconds
```

### Basic Cache Mount Syntax

```dockerfile
RUN --mount=type=cache,target=/root/.cache/uv \
    uv sync --frozen
```

Key parameters:
- `target=/root/.cache/uv`: Where uv stores downloaded packages
- `type=cache`: Persist between builds
- `id=uv-cache`: (Optional) Unique cache identifier for multiple caches
- `sharing=locked`: (Default) Exclusive access during build
- `sharing=shared`: Allow concurrent access (use carefully)

### Multi-Cache Strategy

Separate caches for different stages:

```dockerfile
# Build stage - caches downloaded packages
RUN --mount=type=cache,target=/root/.cache/uv,id=uv-build \
    uv sync --frozen --no-dev

# Bytecode compilation - can use same cache
RUN --mount=type=cache,target=/root/.cache/uv,id=uv-build \
    find /app/.venv -name '*.py' -exec python -m compileall {} \;
```

### Cache Invalidation

Cache persists by default. Force rebuild when needed:

```bash
docker build --no-cache -t myapp:latest .
```

Or keep cache but force specific layers:

```bash
docker build --build-arg BUST_CACHE="$(date +%s)" -t myapp:latest .
```

With Dockerfile:

```dockerfile
ARG BUST_CACHE=default
RUN --mount=type=cache,target=/root/.cache/uv \
    echo "Cache bust: ${BUST_CACHE}" && \
    uv sync --frozen
```

---

## Multi-Stage Build Patterns

### Pattern 1: Standard Multi-Stage (Recommended)

```dockerfile
# Build stage
FROM ghcr.io/astral-sh/uv:python3.12-bookworm-slim AS builder

WORKDIR /app

# Optimization flags
ENV UV_COMPILE_BYTECODE=1
ENV UV_LINK_MODE=copy

# Copy dependency files (cached independently)
COPY pyproject.toml uv.lock ./

# Install dependencies only (leverages Docker layer cache)
RUN --mount=type=cache,target=/root/.cache/uv \
    uv sync --frozen --no-dev --no-install-project

# Copy application code
COPY . .

# Install project into venv
RUN --mount=type=cache,target=/root/.cache/uv \
    uv sync --frozen --no-dev

# Runtime stage - minimal base image
FROM python:3.12-slim-bookworm

WORKDIR /app

# Create non-root user
RUN groupadd --system --gid 999 app \
    && useradd --system --gid 999 --uid 999 --create-home app

# Copy only venv and source from builder
COPY --from=builder --chown=app:app /app/.venv /app/.venv
COPY --from=builder --chown=app:app /app/src /app/src

# Update PATH
ENV PATH="/app/.venv/bin:$PATH" \
    PYTHONDONTWRITEBYTECODE=1 \
    PYTHONUNBUFFERED=1

USER app

CMD ["python", "-m", "myapp"]
```

**Benefits**:
- Runtime image excludes uv, git, build tools (~200MB smaller)
- Bytecode pre-compilation improves startup
- Copy link mode enables Docker layer caching
- Non-root user for security

### Pattern 2: Minimal distroless Runtime

For smallest images, use distroless base:

```dockerfile
# Build stage
FROM ghcr.io/astral-sh/uv:python3.12-bookworm-slim AS builder

WORKDIR /app
ENV UV_COMPILE_BYTECODE=1
ENV UV_LINK_MODE=copy

COPY pyproject.toml uv.lock ./
RUN --mount=type=cache,target=/root/.cache/uv \
    uv sync --frozen --no-dev --no-install-project

COPY . .
RUN --mount=type=cache,target=/root/.cache/uv \
    uv sync --frozen --no-dev

# Runtime: distroless Python
FROM python:3.12-slim-distroless

WORKDIR /app
COPY --from=builder /app/.venv /app/.venv
COPY --from=builder /app/src /app/src

ENV PATH="/app/.venv/bin:$PATH" \
    PYTHONDONTWRITEBYTECODE=1

CMD ["python", "-m", "myapp"]
```

**Image sizes** (typical Django app):
- Standard multi-stage: ~180MB
- Distroless runtime: ~120MB
- With Alpine: ~80MB (but Python slower)

### Pattern 3: Build Cache Optimization

Maximize Docker layer caching:

```dockerfile
FROM ghcr.io/astral-sh/uv:python3.12-bookworm-slim AS builder

WORKDIR /app
ENV UV_COMPILE_BYTECODE=1
ENV UV_LINK_MODE=copy

# Layer 1: Copy only lock + manifest (cached longer)
COPY pyproject.toml uv.lock ./

# Layer 2: Dependencies (cached if lock unchanged)
RUN --mount=type=cache,target=/root/.cache/uv \
    uv sync --frozen --no-dev --no-install-project

# Layer 3: Source code (changes frequently)
COPY . .

# Layer 4: Install project (rebuilds when source changes)
RUN --mount=type=cache,target=/root/.cache/uv \
    uv sync --frozen --no-dev

# ... runtime stage ...
```

Typical cache hit rates:
1. Clean build: 0% (all layers rebuild)
2. Change source code: 75% (layers 1-3 cached)
3. Change dependencies: 50% (layer 1 cached)
4. No changes: 100% (all layers cached)

### Pattern 4: Dev/Prod Dockerfile Matrix

Use ARG for flexible builds:

```dockerfile
ARG PYTHON_VERSION=3.12
ARG INSTALL_DEV=false

FROM ghcr.io/astral-sh/uv:python${PYTHON_VERSION}-bookworm-slim AS builder

WORKDIR /app
ENV UV_COMPILE_BYTECODE=1
ENV UV_LINK_MODE=copy

COPY pyproject.toml uv.lock ./

# Conditional dependency installation
RUN --mount=type=cache,target=/root/.cache/uv \
    if [ "${INSTALL_DEV}" = "true" ]; then \
      uv sync --frozen; \
    else \
      uv sync --frozen --no-dev; \
    fi

COPY . .
RUN --mount=type=cache,target=/root/.cache/uv \
    uv sync --frozen $([ "${INSTALL_DEV}" != "true" ] && echo "--no-dev")

FROM python:${PYTHON_VERSION}-slim-bookworm
WORKDIR /app

RUN groupadd --system --gid 999 app && \
    useradd --system --gid 999 --uid 999 --create-home app

COPY --from=builder --chown=app:app /app/.venv /app/.venv
COPY --from=builder --chown=app:app /app/src /app/src

ENV PATH="/app/.venv/bin:$PATH" \
    PYTHONDONTWRITEBYTECODE=1 \
    PYTHONUNBUFFERED=1

USER app
CMD ["python", "-m", "myapp"]
```

Build commands:

```bash
# Production (no dev dependencies)
docker build -t myapp:prod .

# Development (includes dev dependencies)
docker build --build-arg INSTALL_DEV=true -t myapp:dev .

# Different Python version
docker build --build-arg PYTHON_VERSION=3.11 -t myapp:py311 .
```

---

## Official uv Base Images

### Image Variants

Official images at `ghcr.io/astral-sh/uv`:

| Image | OS | Python | Python Installed | Size |
|-------|----|---------|----|------|
| `latest` | - | - | No | 40MB |
| `bookworm-slim` | Debian 12 | No | No | 50MB |
| `python3.12-bookworm-slim` | Debian 12 | Yes | Yes | 200MB |
| `python3.12-alpine` | Alpine | Yes | Yes | 120MB |
| `python3.11-bookworm-slim` | Debian 12 | Yes | Yes | 200MB |

### Version Pinning Strategy

**For development**: Use latest patch version
```dockerfile
FROM ghcr.io/astral-sh/uv:python3.12-bookworm-slim
```

**For production**: Pin exact version
```dockerfile
FROM ghcr.io/astral-sh/uv:0.9.18-python3.12-bookworm-slim
```

**For maximum reproducibility**: Use SHA256 digest
```dockerfile
FROM ghcr.io/astral-sh/uv@sha256:2381d6aa60c326b71fd40023f921a0a3b8f91b14d5db6b90402e65a635053709
```

Find SHA:
```bash
docker inspect ghcr.io/astral-sh/uv:0.9.18-python3.12-bookworm-slim | grep -i digest
```

### Installing uv in Custom Base Images

**Option 1: Copy from Official Image**

```dockerfile
FROM python:3.12-slim-bookworm

# Copy pre-built uv binary
COPY --from=ghcr.io/astral-sh/uv:0.9.18 /uv /uvx /bin/

# Verify installation
RUN uv --version
```

Fast and zero-dependency.

**Option 2: Install Script**

```dockerfile
FROM python:3.12-slim-bookworm

RUN apt-get update && apt-get install -y --no-install-recommends \
    curl ca-certificates && \
    rm -rf /var/lib/apt/lists/*

ADD https://astral.sh/uv/install.sh /uv-installer.sh
RUN sh /uv-installer.sh && rm /uv-installer.sh

ENV PATH="/root/.local/bin:$PATH"
```

**Option 3: Extract from Pre-built Image**

```dockerfile
FROM python:3.12-slim-bookworm

# Extract uv binary from pre-built container
COPY --from=ghcr.io/astral-sh/uv:latest /uv /bin/

CMD ["uv", "--version"]
```

---

## uv-Managed Python

Instead of relying on system Python, let uv manage Python versions for smaller, more portable images.

### Architecture

uv can download and install Python versions independently:

```dockerfile
FROM ghcr.io/astral-sh/uv:bookworm-slim AS builder

# Install managed Python (not system Python)
ENV UV_PYTHON_INSTALL_DIR=/python
ENV UV_PYTHON_PREFERENCE=only-managed

RUN uv python install 3.12
```

This downloads Python 3.12 to `/python` instead of using system Python.

### Minimal Image with Managed Python

```dockerfile
# Build stage
FROM ghcr.io/astral-sh/uv:bookworm-slim AS builder

WORKDIR /app

# Configure uv to manage Python
ENV UV_COMPILE_BYTECODE=1
ENV UV_LINK_MODE=copy
ENV UV_PYTHON_INSTALL_DIR=/python
ENV UV_PYTHON_PREFERENCE=only-managed

# Install Python (cached separately)
RUN --mount=type=cache,target=/root/.cache/uv \
    uv python install 3.12

# Install dependencies
COPY pyproject.toml uv.lock ./
RUN --mount=type=cache,target=/root/.cache/uv \
    uv sync --frozen --no-dev --no-install-project

COPY . .
RUN --mount=type=cache,target=/root/.cache/uv \
    uv sync --frozen --no-dev

# Runtime: Minimal base (no Python installed)
FROM debian:bookworm-slim

WORKDIR /app

RUN groupadd --system --gid 999 app && \
    useradd --system --gid 999 --uid 999 --create-home app

# Copy Python and venv from builder
COPY --from=builder /python /python
COPY --from=builder /app/.venv /app/.venv
COPY --from=builder /app/src /app/src

ENV PATH="/python/bin:/app/.venv/bin:$PATH" \
    PYTHONDONTWRITEBYTECODE=1 \
    PYTHONUNBUFFERED=1

USER app

CMD ["python", "-m", "myapp"]
```

### Benefits vs Drawbacks

**Benefits**:
- Minimal base image (Debian slim instead of Python slim)
- Portable: Python included in image
- Version consistency: Exact Python across environments

**Drawbacks**:
- Image size slightly larger than using system Python slim
- Not useful if you need system packages that depend on specific Python

**Best for**: Alpine or minimal Debian where system Python isn't available/suitable.

---

## Non-Root User Setup

Running as root in containers is a security risk. Always use non-root users in production.

### Standard Setup

```dockerfile
FROM ghcr.io/astral-sh/uv:python3.12-bookworm-slim

# Create non-root user (must happen before copying files)
RUN groupadd --system --gid 999 app && \
    useradd --system \
      --gid 999 \
      --uid 999 \
      --create-home \
      --shell /sbin/nologin \
      app

WORKDIR /app

# Copy with ownership
COPY --chown=app:app . .

# Install dependencies as app user
USER app
RUN uv sync --frozen --no-dev

ENV PATH="/app/.venv/bin:$PATH"
CMD ["python", "-m", "myapp"]
```

Key points:
- `--system`: Creates system user (not login shell)
- `--gid 999 --uid 999`: Predictable, non-privileged IDs
- `--create-home`: Creates home directory
- `--chown=app:app`: Transfer ownership of COPY/ADD
- `USER app`: Switch before running commands

### Multi-Stage Non-Root

```dockerfile
FROM ghcr.io/astral-sh/uv:python3.12-bookworm-slim AS builder

WORKDIR /app
ENV UV_COMPILE_BYTECODE=1
ENV UV_LINK_MODE=copy

COPY pyproject.toml uv.lock ./
RUN --mount=type=cache,target=/root/.cache/uv \
    uv sync --frozen --no-dev --no-install-project

COPY . .
RUN --mount=type=cache,target=/root/.cache/uv \
    uv sync --frozen --no-dev

# Runtime with non-root user
FROM python:3.12-slim-bookworm

WORKDIR /app

# Create non-root user and group
RUN groupadd --system --gid 999 app && \
    useradd --system --gid 999 --uid 999 --create-home app

# Copy from builder with ownership
COPY --from=builder --chown=app:app /app/.venv /app/.venv
COPY --from=builder --chown=app:app /app/src /app/src

ENV PATH="/app/.venv/bin:$PATH" \
    PYTHONDONTWRITEBYTECODE=1 \
    PYTHONUNBUFFERED=1

USER app

CMD ["python", "-m", "myapp"]
```

### Verify User at Runtime

```bash
docker run myapp:latest whoami
# Output: app

docker run myapp:latest id
# Output: uid=999(app) gid=999(app) groups=999(app)
```

---

## Development Workflows

### Local Development with Bind Mounts

For interactive development, mount your source code:

```bash
#!/bin/bash
docker run -it --rm \
  --volume "$(pwd):/app" \
  --volume /app/.venv \
  --publish 8000:8000 \
  myapp:dev \
  uv run uvicorn main:app --reload --host 0.0.0.0
```

Flags:
- `-v $(pwd):/app`: Mount current directory as `/app`
- `-v /app/.venv`: Named volume for venv (persists between runs)
- `-p 8000:8000`: Expose port 8000
- `--reload`: Auto-reload on file changes

### Docker Compose with Watch

Docker Compose 2.0+ supports `watch` mode for automatic file syncing:

```yaml
# compose.yml
version: '3.8'

services:
  app:
    build:
      context: .
      dockerfile: Dockerfile
    ports:
      - "8000:8000"
    environment:
      - DEBUG=1
    develop:
      watch:
        # Sync source changes
        - action: sync
          path: .
          target: /app
          ignore:
            - .venv/
            - __pycache__/
            - .git/
        # Rebuild on dependency changes
        - action: rebuild
          path: pyproject.toml
        - action: rebuild
          path: uv.lock
```

Usage:

```bash
# Watch for changes and auto-sync/rebuild
docker compose watch

# Run normally (one-shot)
docker compose up
```

### Dev Dockerfile

Separate development Dockerfile with dev dependencies:

```dockerfile
# Dockerfile.dev
FROM ghcr.io/astral-sh/uv:python3.12-bookworm-slim

WORKDIR /app

ENV UV_COMPILE_BYTECODE=0

RUN groupadd --system --gid 999 app && \
    useradd --system --gid 999 --uid 999 --create-home app

COPY pyproject.toml uv.lock ./
RUN --mount=type=cache,target=/root/.cache/uv \
    uv sync --frozen

COPY --chown=app:app . .

USER app

ENV PATH="/app/.venv/bin:$PATH"
CMD ["bash"]
```

Build and use:

```bash
docker build -f Dockerfile.dev -t myapp:dev .
docker run -it --rm -v $(pwd):/app myapp:dev bash
```

### Interactive Shell

```bash
docker run -it --rm \
  --volume "$(pwd):/app" \
  --volume /app/.venv \
  myapp:dev \
  bash

# Inside container:
$ uv run pytest
$ uv run python
$ uv sync --all-extras
```

---

## CI/CD Integration

### GitHub Actions

#### Basic Setup

```yaml
# .github/workflows/test.yml
name: Tests

on: [push, pull_request]

jobs:
  test:
    runs-on: ubuntu-latest

    steps:
      - uses: actions/checkout@v4

      - name: Install uv
        uses: astral-sh/setup-uv@v4
        with:
          version: "0.9.18"
          enable-cache: true

      - name: Set Python version
        run: uv python install 3.12

      - name: Install dependencies
        run: uv sync --frozen

      - name: Run tests
        run: uv run pytest --cov=myapp

      - name: Lint
        run: uv run ruff check .

      - name: Type check
        run: uv run mypy myapp/
```

#### Docker Build and Push

```yaml
# .github/workflows/docker.yml
name: Docker Build

on:
  push:
    branches: [main]
    tags: ['v*']

env:
  REGISTRY: ghcr.io
  IMAGE_NAME: ${{ github.repository }}

jobs:
  build:
    runs-on: ubuntu-latest
    permissions:
      contents: read
      packages: write

    steps:
      - uses: actions/checkout@v4

      - name: Set up Docker Buildx
        uses: docker/setup-buildx-action@v3

      - name: Log in to Container Registry
        uses: docker/login-action@v3
        with:
          registry: ${{ env.REGISTRY }}
          username: ${{ github.actor }}
          password: ${{ secrets.GITHUB_TOKEN }}

      - name: Extract metadata
        id: meta
        uses: docker/metadata-action@v5
        with:
          images: ${{ env.REGISTRY }}/${{ env.IMAGE_NAME }}
          tags: |
            type=ref,event=branch
            type=semver,pattern={{version}}
            type=semver,pattern={{major}}.{{minor}}
            type=sha

      - name: Build and push
        uses: docker/build-push-action@v5
        with:
          context: .
          push: true
          tags: ${{ steps.meta.outputs.tags }}
          labels: ${{ steps.meta.outputs.labels }}
          cache-from: type=gha
          cache-to: type=gha,mode=max
```

**Key features**:
- `astral-sh/setup-uv@v4`: Official setup action
- `enable-cache: true`: Cache venv between jobs
- Docker Buildx: Multi-platform builds
- GitHub Actions cache backend: Persist cache between runs

#### Monorepo Package Testing

```yaml
# .github/workflows/test-packages.yml
name: Test Packages

on: [push, pull_request]

jobs:
  test:
    runs-on: ubuntu-latest
    strategy:
      matrix:
        package: [pkg-a, pkg-b, pkg-common]

    steps:
      - uses: actions/checkout@v4

      - name: Install uv
        uses: astral-sh/setup-uv@v4

      - name: Install dependencies
        run: uv sync --package ${{ matrix.package }} --frozen

      - name: Test package
        run: uv run --package ${{ matrix.package }} pytest
```

### GitLab CI

#### Basic Pipeline

```yaml
# .gitlab-ci.yml
image: ghcr.io/astral-sh/uv:python3.12-bookworm-slim

variables:
  UV_CACHE_DIR: .uv-cache

cache:
  paths:
    - .uv-cache/

before_script:
  - uv sync --frozen

test:
  script:
    - uv run pytest
  coverage: '/TOTAL.*\s+(\d+%)$/'

lint:
  script:
    - uv run ruff check .
    - uv run mypy myapp/

build:
  image: docker:latest
  services:
    - docker:dind
  script:
    - docker build -t myapp:$CI_COMMIT_SHA .
    - docker push myapp:$CI_COMMIT_SHA
```

#### Docker Build with Cache

```yaml
# .gitlab-ci.yml
image: docker:latest

variables:
  DOCKER_DRIVER: overlay2
  DOCKER_BUILDKIT: "1"

docker_build:
  services:
    - docker:dind
  before_script:
    - docker login -u $CI_REGISTRY_USER -p $CI_REGISTRY_PASSWORD $CI_REGISTRY
  script:
    - docker buildx build
        --cache-from type=registry,ref=$CI_REGISTRY_IMAGE:buildcache
        --cache-to type=registry,ref=$CI_REGISTRY_IMAGE:buildcache,mode=max
        -t $CI_REGISTRY_IMAGE:$CI_COMMIT_SHA
        -t $CI_REGISTRY_IMAGE:latest
        --push
        .
```

#### Monorepo Package Testing

```yaml
# .gitlab-ci.yml
test:package-a:
  script:
    - uv sync --package pkg-a --frozen
    - uv run --package pkg-a pytest

test:package-b:
  script:
    - uv sync --package pkg-b --frozen
    - uv run --package pkg-b pytest

test:package-common:
  script:
    - uv sync --package pkg-common --frozen
    - uv run --package pkg-common pytest
```

### Other CI Systems

#### GitHub Actions with Container Images

```yaml
jobs:
  test:
    container:
      image: ghcr.io/astral-sh/uv:python3.12-bookworm-slim

    steps:
      - uses: actions/checkout@v4

      - name: Run tests
        run: |
          uv sync --frozen
          uv run pytest
```

#### Generic CI (Bash Script)

```bash
#!/bin/bash
set -e

# Install uv (if not available)
if ! command -v uv &> /dev/null; then
    curl -LsSf https://astral.sh/uv/install.sh | sh
    export PATH="$HOME/.local/bin:$PATH"
fi

# Run CI pipeline
uv lock --check          # Ensure lockfile up-to-date
uv sync --frozen         # Install dependencies
uv run pytest            # Run tests
uv run ruff check .      # Lint
uv run mypy myapp/       # Type check

echo "All checks passed!"
```

---

## Serverless Deployment

### AWS Lambda with uv export

uv can export lockfiles to `requirements.txt`, enabling traditional Lambda layer build processes:

```dockerfile
# Lambda-optimized build
FROM ghcr.io/astral-sh/uv:0.9.18 AS uv

# Builder stage
FROM public.ecr.aws/lambda/python:3.13 AS builder

# Copy uv binary
COPY --from=uv /uv /bin/uv

WORKDIR /tmp/build

# Environment optimization
ENV UV_COMPILE_BYTECODE=1
ENV UV_NO_INSTALLER_METADATA=1
ENV UV_LINK_MODE=copy

# Copy project files
COPY pyproject.toml uv.lock ./

# Export requirements and install to Lambda task root
RUN --mount=type=cache,target=/root/.cache/uv \
    uv export --frozen --no-dev -o requirements.txt && \
    uv pip install -r requirements.txt --target "${LAMBDA_TASK_ROOT}"

# Copy application code
COPY ./app ${LAMBDA_TASK_ROOT}/app

# Runtime stage
FROM public.ecr.aws/lambda/python:3.13

WORKDIR ${LAMBDA_TASK_ROOT}

# Copy built environment
COPY --from=builder ${LAMBDA_TASK_ROOT} ${LAMBDA_TASK_ROOT}

# Lambda handler
CMD ["app.main.handler"]
```

**Key considerations**:
- `UV_NO_INSTALLER_METADATA=1`: Skip pip metadata (not needed on Lambda)
- `--compile-bytecode`: Faster cold starts
- `uv export`: Traditional requirements.txt for compatibility
- Lambda task root: `/var/task`

Deploy:

```bash
aws ecr get-login-password --region us-east-1 | \
  docker login --username AWS --password-stdin 123456789.dkr.ecr.us-east-1.amazonaws.com

docker build -t lambda-function .
docker tag lambda-function:latest 123456789.dkr.ecr.us-east-1.amazonaws.com/lambda-function:latest
docker push 123456789.dkr.ecr.us-east-1.amazonaws.com/lambda-function:latest

aws lambda update-function-code \
  --function-name my-function \
  --image-uri 123456789.dkr.ecr.us-east-1.amazonaws.com/lambda-function:latest
```

### Google Cloud Run

```dockerfile
FROM ghcr.io/astral-sh/uv:python3.12-bookworm-slim AS builder

WORKDIR /app
ENV UV_COMPILE_BYTECODE=1
ENV UV_LINK_MODE=copy

COPY pyproject.toml uv.lock ./
RUN --mount=type=cache,target=/root/.cache/uv \
    uv sync --frozen --no-dev --no-install-project

COPY . .
RUN --mount=type=cache,target=/root/.cache/uv \
    uv sync --frozen --no-dev

FROM python:3.12-slim-bookworm

WORKDIR /app

RUN groupadd --system --gid 999 app && \
    useradd --system --gid 999 --uid 999 --create-home app

COPY --from=builder --chown=app:app /app/.venv /app/.venv
COPY --from=builder --chown=app:app /app . .

ENV PATH="/app/.venv/bin:$PATH" \
    PORT=8080 \
    PYTHONUNBUFFERED=1

USER app

# Cloud Run expects HTTP server on PORT
EXPOSE 8080
CMD ["python", "-m", "uvicorn", "main:app", "--host", "0.0.0.0", "--port", "8080"]
```

Deploy:

```bash
docker build -t gcr.io/PROJECT_ID/function .
docker push gcr.io/PROJECT_ID/function

gcloud run deploy function \
  --image gcr.io/PROJECT_ID/function \
  --region us-central1 \
  --memory 512Mi
```

---

## Workspace-Specific Builds

For monorepos with multiple packages, build and deploy individual packages:

### Workspace Structure

```
python-monorepo/
├── pyproject.toml          # Workspace root
├── uv.lock
├── packages/
│   ├── pkg-core/
│   │   ├── pyproject.toml
│   │   └── src/
│   ├── pkg-api/
│   │   ├── pyproject.toml
│   │   └── src/
│   └── pkg-cli/
│       ├── pyproject.toml
│       └── src/
└── Dockerfile
```

### Root pyproject.toml

```toml
[workspace]
members = ["packages/pkg-core", "packages/pkg-api", "packages/pkg-cli"]
```

### Package-Specific Build

```dockerfile
# Build for specific package
ARG PACKAGE=pkg-api

FROM ghcr.io/astral-sh/uv:python3.12-bookworm-slim AS builder

WORKDIR /app
ENV UV_COMPILE_BYTECODE=1
ENV UV_LINK_MODE=copy

COPY pyproject.toml uv.lock ./
COPY packages/ ./packages/

# Sync workspace
RUN --mount=type=cache,target=/root/.cache/uv \
    uv sync --frozen --no-dev --no-install-project

# Install specific package
RUN --mount=type=cache,target=/root/.cache/uv \
    uv sync --package=${PACKAGE} --frozen --no-dev

FROM python:3.12-slim-bookworm

WORKDIR /app

RUN groupadd --system --gid 999 app && \
    useradd --system --gid 999 --uid 999 --create-home app

# Copy entire workspace structure
COPY --from=builder --chown=app:app /app/.venv /app/.venv
COPY --from=builder --chown=app:app /app/packages /app/packages

ENV PATH="/app/.venv/bin:$PATH" \
    PYTHONDONTWRITEBYTECODE=1 \
    PYTHONUNBUFFERED=1

USER app

CMD ["python", "-m", "pkg_api"]
```

Build specific packages:

```bash
# Build pkg-api
docker build --build-arg PACKAGE=pkg-api -t mycompany/api:latest .

# Build pkg-cli
docker build --build-arg PACKAGE=pkg-cli -t mycompany/cli:latest .

# Build pkg-core (library)
docker build --build-arg PACKAGE=pkg-core -t mycompany/core:latest .
```

### CI Matrix Build

```yaml
# .github/workflows/docker-packages.yml
name: Build Packages

on:
  push:
    branches: [main]

jobs:
  build:
    runs-on: ubuntu-latest
    strategy:
      matrix:
        package:
          - pkg-api
          - pkg-cli
          - pkg-core

    steps:
      - uses: actions/checkout@v4

      - name: Set up Docker Buildx
        uses: docker/setup-buildx-action@v3

      - name: Build and push
        uses: docker/build-push-action@v5
        with:
          context: .
          build-args: PACKAGE=${{ matrix.package }}
          push: true
          tags: mycompany/${{ matrix.package }}:latest
```

---

## Performance Benchmarks

Typical rebuild times with various optimizations:

### Scenario: 50-package monorepo with 200 dependencies

| Scenario | Tool | BuildKit | Cache Mounts | Time | Notes |
|----------|------|----------|--------------|------|-------|
| **Cold build** | pip | - | - | 420s | No optimization |
| **Cold build** | uv | No | No | 95s | Pure speed gain |
| **Cold build** | uv | Yes | Yes | 95s | First run always full |
| **Warm rebuild** | pip | - | - | 380s | Minimal caching |
| **Warm rebuild** | uv | No | No | 85s | Direct cache hit |
| **Warm rebuild** | uv | Yes | Yes | 8s | **Buildkit cache mounts** |
| **Change code** | uv | Yes | Yes | 12s | Reuses dep layer |
| **Change deps** | uv | Yes | Yes | 50s | Rebuilds deps |

### Speed-up Hierarchy

1. **uv vs pip**: 4-5x faster (fundamental advantage)
2. **BuildKit cache mounts**: 10x faster rebuilds (most impactful)
3. **Multi-stage builds**: 50-70% smaller final images
4. **Bytecode compilation**: 5-10% faster startup times
5. **Link mode (copy)**: Enables all caching benefits

**Real-world impact**: Reducing `docker build` from 5 minutes → 30 seconds enables rapid iteration in CI/CD.

---

## Troubleshooting

### Cache Not Working

**Symptoms**: `docker build` not using cache, slow rebuilds

**Diagnosis**:

```bash
# Check BuildKit is enabled
docker buildx version

# Inspect cache with verbose logging
DOCKER_BUILDKIT=1 docker build --verbose .
```

**Solutions**:

1. Ensure `RUN --mount=type=cache` syntax (requires BuildKit)
2. Check `UV_LINK_MODE=copy` is set
3. Verify cache directory exists: `ls -la /root/.cache/uv`
4. Force rebuild: `docker build --no-cache .`

### Permission Denied Errors

**Symptom**: `permission denied` when installing dependencies as non-root user

**Cause**: venv directory owned by root from COPY

**Solution**:

```dockerfile
# Use --chown during COPY
COPY --chown=app:app pyproject.toml uv.lock ./

# Or set proper permissions
RUN chown -R app:app /app
```

### Out of Disk Space

**Symptom**: `no space left on device` during build

**Cause**: uv cache or image layers consuming disk

**Solution**:

```bash
# Clean Docker system
docker system prune -a

# Clean uv cache in Dockerfile
RUN --mount=type=cache,target=/root/.cache/uv \
    uv sync && \
    rm -rf /root/.cache/uv/*

# Or disable caching
ENV UV_NO_CACHE=1
```

### Python Version Mismatch

**Symptom**: `RuntimeError: Python version mismatch`

**Cause**: Different Python versions between build and runtime stages

**Solution**:

```dockerfile
# Pin Python in both stages
FROM ghcr.io/astral-sh/uv:python3.12-bookworm-slim AS builder
# ... build ...

FROM python:3.12-slim-bookworm  # <-- Match version
```

### Missing Dependencies at Runtime

**Symptom**: `ModuleNotFoundError` when running container

**Cause**: Using `--no-install-project` without final `uv sync`

**Solution**:

```dockerfile
# This is WRONG:
RUN uv sync --frozen --no-dev --no-install-project
# (Never syncs the project itself)

# This is CORRECT:
RUN uv sync --frozen --no-dev --no-install-project
COPY . .
RUN uv sync --frozen --no-dev  # <-- Final sync installs project
```

### Slow Image Pulls

**Symptom**: `docker pull` very slow from ghcr.io

**Cause**: Network or registry latency

**Solution**:

```bash
# Use specific region (Europe)
FROM ghcr.io/astral-sh/uv:python3.12-bookworm-slim

# Pre-pull image to warm cache
docker pull ghcr.io/astral-sh/uv:python3.12-bookworm-slim

# Use local mirror if available
# FROM registry.internal.company.com/uv:python3.12-bookworm-slim
```

### Bytecode Not Compiled

**Symptom**: No `.pyc` files in final image

**Cause**: `UV_COMPILE_BYTECODE=1` only works in build stage

**Solution**:

```dockerfile
# Enable in builder stage
FROM ghcr.io/astral-sh/uv:python3.12-bookworm-slim AS builder

ENV UV_COMPILE_BYTECODE=1  # <-- Must be here

RUN uv sync --frozen
```

Verify:

```bash
docker run myapp:latest find /app/.venv -name '*.pyc' | head -5
```

---

## Resources

### Official Documentation

- [uv Documentation](https://docs.astral.sh/uv/)
- [uv Docker Images](https://docs.astral.sh/uv/docker/)
- [Docker BuildKit Reference](https://docs.docker.com/build/buildkit/)

### Learning Resources

- [Docker Multi-Stage Builds](https://docs.docker.com/build/building/multi-stage/)
- [distroless Images](https://github.com/GoogleContainerTools/distroless)
- [Dockerfile Best Practices](https://docs.docker.com/develop/develop-images/dockerfile_best-practices/)

### Example Repositories

- [Astral uv Examples](https://github.com/astral-sh/uv/tree/main/examples)
- [FastAPI Docker Examples](https://fastapi.tiangolo.com/deployment/docker/)
- [Python Docker Security](https://pythonspeed.com/articles/docker-build-package-install-linux/)

### Performance Profiling

```bash
# Build with timing information
DOCKER_BUILDKIT=1 docker build -t myapp:latest . 2>&1 | grep "cached\|COPY\|RUN"

# Inspect final image size
docker inspect myapp:latest | grep -i size
docker images | grep myapp

# Profile startup time
time docker run --rm myapp:latest python -c "import sys; print('Ready')"
```

### Community

- [uv GitHub Discussions](https://github.com/astral-sh/uv/discussions)
- [Python Docker Best Practices](https://docs.docker.com/language/python/)
- [Container Security](https://github.com/aquasecurity/trivy)
