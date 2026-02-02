# Turborepo Reference

Turborepo delivers intelligent task orchestration and caching for TypeScript/JavaScript monorepos with a focus on simplicity and speed. Combined with pnpm workspaces, it provides the optimal simplicity-to-power ratio for most teams.

## When to Use Turborepo

Adopt Turborepo when:
- JavaScript/TypeScript-focused monorepo
- Seeking balance between simplicity and features
- CI times need optimization (via Vercel Remote Cache)
- pnpm workspace already in use
- Minimal learning curve preferred
- 15-minute setup target

Turborepo is ideal for projects valuing pragmatism over sophistication. Consider Nx for more features or Pants for Python-primary codebases.

## Core Concepts

### Task Orchestration

Turborepo understands task dependencies across your monorepo:

```
build (lib)
    ↓
build (api)
    ↓
build (web)
    ↓
dev (web) [long-lived process]
```

**Non-blocking parallel tasks** (no dependencies):
```
lint
test
typecheck
```

Can all run simultaneously since they don't depend on each other.

### Caching Strategy

Turborepo caches:
1. **Task outputs**: Files in `outputs` directories
2. **Computation hash**: Hash of inputs + task definition
3. **Remote cache**: Results from previous builds (Vercel Remote Cache)

Cache hit detection:

```
Input files (source code, dependencies) → Hash(inputs) → Check cache
                                                          ├─ Hit → Use output
                                                          └─ Miss → Run task
```

## turbo.json Configuration

### Basic Structure

```json
{
  "$schema": "https://turborepo.org/schema.json",
  "version": "1",
  "tasks": {
    "build": {
      "dependsOn": ["^build"],
      "outputs": ["dist/**", ".next/**"],
      "cache": true
    },
    "lint": {
      "outputs": [],
      "cache": true
    },
    "test": {
      "dependsOn": ["build"],
      "outputs": ["coverage"],
      "cache": true
    },
    "dev": {
      "cache": false,
      "persistent": true
    }
  },
  "globalDependencies": ["package.json", "turbo.json"]
}
```

### Task Configuration Fields

**dependsOn**: Define task dependencies
- `"^build"` → This project's dependencies must build first
- `"build"` → Previous task in same project
- `["//" prefix]` → Workspace root dependency

**outputs**: Files to cache after task completion
- Glob patterns (e.g., `"dist/**"`, `".next/**"`)
- Empty list for no outputs

**cache**: Whether to cache task results

**persistent**: Keep running across reruns (for dev servers)

**inputs**: Files affecting cache validation (optional)

**outputMode**: Control output behavior (`"full"`, `"errors-only"`, `"minimal"`)

### Advanced Configuration

```json
{
  "tasks": {
    "build": {
      "dependsOn": ["^build"],
      "outputs": ["dist/**"],
      "inputs": ["src/**/*.ts", "package.json"],
      "cache": true,
      "outputMode": "errors-only"
    },
    "test": {
      "dependsOn": ["build"],
      "outputs": ["coverage"],
      "inputs": ["src/**", "tests/**"],
      "cache": true
    },
    "deploy": {
      "cache": false,
      "outputs": ["deployment-info.json"],
      "env": ["DEPLOYMENT_ENV"]  // Never cache if env var changes
    }
  },
  "globalDependencies": [
    "package.json",
    "pnpm-lock.yaml",
    ".env.local"
  ],
  "globalEnv": ["NODE_ENV"]
}
```

## pnpm Workspace Integration

### pnpm-workspace.yaml Setup

```yaml
packages:
  - 'apps/*'
  - 'packages/*'
  - 'tools/*'

catalog:
  typescript: ^5.3.0
  react: ^18.2.0
  vite: ^5.0.0
  vitest: ^1.0.0
  eslint: ^8.54.0

overrides:
  typescript: ^5.3.0
```

### Package.json Structure

Root package.json:

```json
{
  "name": "monorepo",
  "version": "1.0.0",
  "private": true,
  "packageManager": "pnpm@9.0.0",
  "scripts": {
    "build": "turbo build",
    "test": "turbo test",
    "dev": "turbo dev",
    "lint": "turbo lint",
    "typecheck": "turbo typecheck",
    "clean": "turbo clean && rm -rf node_modules"
  },
  "devDependencies": {
    "turbo": "^1.10.0",
    "typescript": "^5.3.0"
  }
}
```

Workspace member package.json:

```json
{
  "name": "@company/lib-shared",
  "version": "1.0.0",
  "type": "module",
  "exports": {
    ".": {
      "types": "./src/index.ts",
      "import": "./dist/index.js"
    }
  },
  "scripts": {
    "build": "tsc && vite build",
    "test": "vitest",
    "lint": "eslint src"
  },
  "dependencies": {
    "@company/lib-models": "workspace:*"
  },
  "devDependencies": {
    "typescript": "workspace:^"
  }
}
```

### Workspace Protocol

```json
{
  "dependencies": {
    "@company/shared": "workspace:*",      // Exact version
    "@company/utils": "workspace:^1.0.0"   // Relative version
  }
}
```

## Task Dependencies

### Syntax

```json
{
  "tasks": {
    "build": {
      "dependsOn": ["^build"]  // My dependencies' build first
    },
    "test": {
      "dependsOn": ["build"]   // Same project's build first
    },
    "deploy": {
      "dependsOn": ["//build", "test"]  // Root build, then test
    }
  }
}
```

### Complex Dependencies

```json
{
  "tasks": {
    "lint": {
      "cache": true
    },
    "test": {
      "dependsOn": ["build"],
      "cache": true
    },
    "typecheck": {
      "cache": true
    },
    "e2e": {
      "dependsOn": ["build", "test"],
      "cache": false  // Never cache e2e tests
    },
    "deploy": {
      "dependsOn": ["lint", "typecheck", "test"],
      "cache": false
    }
  }
}
```

## Caching and Remote Cache

### Local Cache

Turborepo stores cache in `.turbo/cache/`:

```bash
# View cache location
turbo cache status

# Prune old cache entries
turbo cache clean --days=30

# Clear all cache
rm -rf .turbo/cache
```

### Vercel Remote Cache

```bash
# Authenticate with Vercel
turbo login

# Link project to Vercel
turbo link
```

Automatically uploads cache to Vercel (free tier available).

Manual configuration in turbo.json:

```json
{
  "remoteCache": {
    "signature": true,
    "teamId": "YOUR_TEAM_ID",
    "token": "YOUR_TOKEN"
  }
}
```

### Self-Hosted Remote Cache

Use open-source implementations:

**turborepo-remote-cache** (community):

```bash
# Run cache server
docker run -p 3000:3000 ducktors/turborepo-remote-cache

# Configure in turbo.json
{
  "remoteCache": {
    "apiUrl": "http://localhost:3000"
  }
}
```

Or environment variable:

```bash
export TURBO_API="http://localhost:3000"
turbo build
```

### Cache Strategy Optimization

```json
{
  "tasks": {
    "build": {
      "inputs": ["src/**", "tsconfig.json", "package.json"],
      "outputs": ["dist"],
      "cache": true
    },
    "test": {
      "inputs": ["src/**", "tests/**", "package.json"],
      "outputs": ["coverage"],
      "cache": true
    },
    "dev": {
      "cache": false,
      "persistent": true
    }
  },
  "globalDependencies": [
    "package.json",
    "pnpm-lock.yaml"
  ]
}
```

## Filter Syntax

### Basic Filters

```bash
# Build specific package
turbo build --filter=api

# Build multiple packages
turbo build --filter=api --filter=web

# Build by glob pattern
turbo build --filter="@company/*"

# Exclude packages
turbo build --filter="!legacy"
```

### Dependency Filters

```bash
# Build with dependencies
turbo build --filter=api --include-dependencies

# Build dependents
turbo build --filter="...api"

# Build changed and dependents
turbo build --filter="[origin/main]"

# Complex filters
turbo build --filter="@company/*" --exclude="legacy" --include-dependencies
```

### Usage Examples

```bash
# Build only web and its dependencies
turbo build --filter=web --include-dependencies

# Test all packages that depend on lib-shared
turbo test --filter="...lib-shared"

# Build everything changed since main
turbo build --filter="[origin/main]"

# Test specific package
turbo test --filter=api

# Dev mode for specific package and dependents
turbo dev --filter=web --include-dependencies
```

## CI Integration

### GitHub Actions Workflow

```yaml
name: CI

on:
  push:
    branches: [main]
  pull_request:

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

      - uses: pnpm/action-setup@v2
        with:
          version: 9

      - uses: actions/setup-node@v4
        with:
          node-version: 18
          cache: 'pnpm'

      - run: pnpm install

      - name: Lint
        run: turbo lint

      - name: Test
        run: turbo test

      - name: Build
        run: turbo build

      - name: Deploy (main only)
        if: github.ref == 'refs/heads/main'
        run: turbo deploy
```

### Pull Request Specific CI

```yaml
jobs:
  test:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
        with:
          fetch-depth: 0

      - uses: pnpm/action-setup@v2

      - uses: actions/setup-node@v4
        with:
          node-version: 18
          cache: 'pnpm'

      - run: pnpm install

      # Only affected by PR changes
      - name: Test affected
        run: turbo test --filter="[origin/main]"

      - name: Build affected
        run: turbo build --filter="[origin/main]"

      - name: Lint affected
        run: turbo lint --filter="[origin/main]"
```

### Release Workflow with Turborepo

```yaml
name: Release

on:
  push:
    branches: [main]

jobs:
  release:
    runs-on: ubuntu-latest
    permissions:
      contents: write
      packages: write
    steps:
      - uses: actions/checkout@v4

      - uses: pnpm/action-setup@v2

      - uses: actions/setup-node@v4
        with:
          node-version: 18
          cache: 'pnpm'

      - run: pnpm install

      # Build everything before release
      - name: Build all packages
        run: turbo build

      # Run all tests before release
      - name: Test all packages
        run: turbo test

      # Publish packages
      - name: Publish packages
        run: turbo run publish --filter="[HEAD~1]"
        env:
          NPM_TOKEN: ${{ secrets.NPM_TOKEN }}
```

## Common Commands

### Task Execution

```bash
# Run task on all packages
turbo build

# Run task on specific package
turbo build --filter=api

# Run multiple tasks
turbo build test lint

# Parallel execution (default for independent tasks)
turbo build test lint --parallel

# Watch mode
turbo build --watch

# Dry run (show what would execute)
turbo build --dry

# Verbose output
turbo build --verbose
```

### Filtering and Targeting

```bash
# Build specific packages and dependencies
turbo build --filter=web --include-dependencies

# Build everything that depends on changed package
turbo build --filter="...lib-shared"

# Build only changed packages
turbo build --filter="[origin/main]"

# Exclude packages from execution
turbo build --filter="!legacy"

# Combine filters
turbo build --filter="@company/*" --exclude="legacy"
```

### Remote Cache Management

```bash
# Authenticate with Vercel
turbo login

# Link workspace to Vercel
turbo link

# Check cache status
turbo cache status

# Verify cache hits
turbo build --verbose 2>&1 | grep "Cache hit"
```

### Graph and Analysis

```bash
# Export dependency graph (requires separate tool)
turbo build --graph

# Show task execution plan
turbo build --dry

# Detailed task information
turbo build --verbose
```

## Troubleshooting

### Cache Issues

**Problem**: Cache never hits
```
Solution: Verify inputs in turbo.json match actual files
         Check globalDependencies includes package.json
         Ensure lock file committed (pnpm-lock.yaml)
         Clear cache: rm -rf .turbo/cache
         Verify package versions consistent
```

**Problem**: Stale cache being used
```
Solution: Clear cache: turbo cache clean
         Verify inputs haven't changed
         Check remote cache with wrong version
         Force rebuild: turbo build --no-cache
```

### Dependency Issues

**Problem**: Circular dependency error
```
Solution: Review task dependencies in turbo.json
         Check package.json workspace dependencies
         Use turbo build --dry to see task order
         Refactor circular imports
```

**Problem**: Tasks running out of order
```
Solution: Add missing dependsOn entries
         Verify "^task" syntax for cross-project deps
         Check globalDependencies for shared inputs
         Run turbo build --dry to debug
```

### Remote Cache Issues

**Problem**: Remote cache not connecting
```
Solution: Verify TURBO_TOKEN and TURBO_TEAM env vars
         Check network connectivity to cache server
         Run turbo login to authenticate
         Inspect request logs: turbo build --verbose
```

**Problem**: Signature verification failed
```
Solution: Regenerate authentication token
         Clear .turbo/cache and retry
         Verify cache server is running
         Check that server and client use same token
```

## Advanced Topics

### Custom Task Runners

Execute tasks with custom logic:

```json
{
  "tasks": {
    "build": {
      "dependsOn": ["^build"],
      "outputs": ["dist"],
      "cache": true
    },
    "publish": {
      "dependsOn": ["build"],
      "cache": false,
      "env": ["NPM_TOKEN"]
    }
  }
}
```

### Monorepo-Wide Configuration

Set defaults for all tasks:

```json
{
  "globalDependencies": [
    "package.json",
    "pnpm-lock.yaml",
    ".env"
  ],
  "globalEnv": [
    "NODE_ENV"
  ],
  "tasks": {
    "build": {
      "outputs": ["dist"],
      "cache": true
    }
  }
}
```

### Environment-Based Caching

Disable cache for certain environments:

```json
{
  "tasks": {
    "build": {
      "cache": true
    },
    "deploy": {
      "cache": false,
      "env": ["DEPLOYMENT_ENV"]
    }
  }
}
```

Only if DEPLOYMENT_ENV changes, cache is invalidated.

## Comparing Task Runners

### Turborepo vs Nx

| Factor | Turborepo | Nx |
|--------|-----------|-----|
| Setup time | 15 minutes | 30 minutes |
| Learning curve | Low | Medium |
| Task dependencies | Simple | Advanced |
| Code generators | None | Excellent |
| Remote caching | Vercel | Nx Cloud |
| IDE integration | Minimal | Excellent |
| Framework support | Agnostic | Opinionated |
| Community size | Growing | Large |

### Best Practices

1. **Pin versions** in pnpm-workspace.yaml catalog
2. **Use workspace:* protocol** for internal dependencies
3. **Cache only deterministic tasks** (avoid mutable operations)
4. **Set outputMode** to control verbosity
5. **Use filters** in CI for affected-only testing
6. **Document task dependencies** in turbo.json comments
7. **Enable remote caching** in CI for speed

## Key Resources

- **Official Documentation**: https://turborepo.dev/docs
- **pnpm Workspaces**: https://pnpm.io/workspaces
- **Vercel Remote Cache**: https://vercel.com/docs/monorepos/turborepo/remote-caching
- **Community Cache**: https://github.com/ducktors/turborepo-remote-cache
- **GitHub Actions Integration**: https://turborepo.dev/docs/ci/github-actions
