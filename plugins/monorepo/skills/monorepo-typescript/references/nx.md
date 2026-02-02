# Nx Framework Reference

Nx provides intelligent task orchestration and code generation for monorepos with a focus on JavaScript/TypeScript and superior developer experience. This guide covers setup, dependency graph visualization, and patterns for teams prioritizing rapid development cycles.

## When to Use Nx

Adopt Nx when:
- JavaScript/TypeScript-focused monorepo
- Need for code generators and scaffolding
- Developer experience and IDE integration critical
- Gentler learning curve preferred over complexity
- CI optimization through affected detection needed
- Nx Cloud infrastructure available

Nx is ideal for JavaScript/TypeScript teams but requires workarounds for Python integration. Consider Turborepo for simpler setups or Pants for Python-primary codebases.

## Core Concepts

### Dependency Graph

Nx auto-infers dependencies from TypeScript imports and package.json references, constructing a directed acyclic graph of projects. This enables intelligent task execution:

```
api
  ├── depends on: lib-shared, lib-models
  └── depends on: @company/sdk (external)

web
  ├── depends on: lib-shared, lib-ui
  └── depends on: @company/sdk (external)

lib-shared
  ├── depends on: lib-models
  └── depends on: lib-utils

lib-models
  ├── depends on: (none)

lib-ui
  ├── depends on: lib-shared
```

### Affected Detection

Only run tasks on changed projects and their dependents:

```bash
nx affected -t test --base=origin/main
# Runs tests only for projects with changes + projects depending on them
```

## nx.json Configuration

### Workspace-Level Configuration

```json
{
  "$schema": "./node_modules/nx/schemas/nx-schema.json",
  "version": 2,
  "extends": "nx/presets/npm.json",
  "npmScope": "mycompany",
  "tasksRunnerOptions": {
    "default": {
      "runner": "nx/tasks-runners/default",
      "options": {
        "cacheableOperations": ["build", "lint", "test", "typecheck"],
        "parallel": 4,
        "captureStderr": false,
        "logOutput": "full"
      }
    }
  },
  "targetDefaults": {
    "build": {
      "dependsOn": ["^build"],
      "cache": true,
      "inputs": ["production", "^production"],
      "outputs": ["{projectRoot}/dist"]
    },
    "test": {
      "dependsOn": ["build"],
      "cache": true,
      "inputs": ["default", "^production"],
      "outputs": ["{projectRoot}/coverage"]
    },
    "lint": {
      "cache": true,
      "inputs": ["default"]
    }
  },
  "namedInputs": {
    "default": ["{projectRoot}/**/*", "!{projectRoot}/**/*.spec.ts"],
    "production": [
      "!{projectRoot}/**/*.spec.ts",
      "!{projectRoot}/**/*.test.ts",
      "!{projectRoot}/README.md"
    ]
  },
  "plugins": [
    {
      "plugin": "@nx/typescript/typescript",
      "options": {
        "extension": "ts"
      }
    },
    {
      "plugin": "@nx/linter/eslint",
      "options": {
        "targetName": "lint"
      }
    }
  ]
}
```

### Key Configuration Sections

**targetDefaults**: Define default task configuration
- `dependsOn`: Task dependencies (e.g., "build" depends on "^build" from dependencies)
- `cache`: Enable caching for this task
- `inputs`: Files/folders that affect task output
- `outputs`: Directories to cache after execution

**namedInputs**: Define reusable input patterns
- `default`: All files except tests
- `production`: Only production files (excluding tests, docs)

**plugins**: Enable framework-specific capabilities
- TypeScript, Linter (ESLint), React, Next.js, Angular, Jest, etc.

## project.json Configuration

### Individual Project Configuration

```json
{
  "name": "lib-shared",
  "sourceRoot": "packages/shared/src",
  "projectType": "library",
  "prefix": "lib",
  "targets": {
    "build": {
      "executor": "@nx/js:tsc",
      "outputs": ["dist/packages/shared"],
      "options": {
        "outputPath": "dist/packages/shared",
        "tsConfig": "packages/shared/tsconfig.lib.json",
        "packageJson": "packages/shared/package.json",
        "main": "packages/shared/src/index.ts"
      },
      "configurations": {
        "production": {
          "optimization": true
        }
      }
    },
    "test": {
      "executor": "@nx/jest:jest",
      "outputs": ["coverage/packages/shared"],
      "options": {
        "jestConfig": "packages/shared/jest.config.js",
        "passWithNoTests": true
      }
    },
    "lint": {
      "executor": "@nx/linter:eslint",
      "outputs": ["{options.outputFile}"],
      "options": {
        "lintFilePatterns": ["packages/shared/**/*.ts"]
      }
    }
  },
  "tags": ["type:lib", "scope:shared"]
}
```

### Tags for Dependency Constraints

```json
{
  "tags": ["type:lib", "scope:shared", "team:platform"]
}
```

Configure constraints in `nx.json`:

```json
{
  "projectGraph": {
    "nodes": {},
    "dependencies": {}
  },
  "constrainedTo": [
    {
      "sourceTag": "type:app",
      "onlyDependsOn": ["type:lib"]
    },
    {
      "sourceTag": "scope:web",
      "onlyDependsOn": ["scope:web", "scope:shared"]
    }
  ]
}
```

## Dependency Graph Management

### Visualizing Dependencies

```bash
# Interactive dependency graph in browser
nx graph

# Focus on specific project
nx graph --focus=lib-shared

# Export as JSON
nx graph --file=graph.json

# Export as PNG (requires graphviz)
nx graph --file=graph.png
```

### Inferring Dependencies

Nx automatically infers dependencies from:
- TypeScript imports: `import { x } from "@company/lib-shared"`
- package.json references: `"@company/lib-shared": "workspace:*"`
- Angular decorator metadata
- Project folder structure

Manual overrides in `nx.json`:

```json
{
  "projectGraph": {
    "dependencies": {
      "api": [
        {
          "source": "api",
          "target": "lib-models",
          "type": "implicit"
        }
      ]
    }
  }
}
```

### Affected Detection Deep Dive

```bash
# All affected by HEAD~1
nx affected -t test --base=HEAD~1 --head=HEAD

# All affected by changes in branch
nx affected -t test --base=origin/main

# Specific projects only (no dependents)
nx affected -t test --base=origin/main --exclude=web

# Verbose output
nx affected -t test --base=origin/main -v

# Dry run (show what would run)
nx affected -t test --base=origin/main --dry-run
```

## Code Generation

### Nx Generators

Create workspace-specific generators:

```bash
nx generate @nx/workspace:npm-package --name=new-lib
nx generate @nx/react:library --name=new-component
nx generate @nx/nest:application --name=new-api
```

### Custom Generators

```typescript
// tools/generators/lib/index.ts
import { Tree, formatFiles, generateFiles } from "@nx/devkit";
import * as path from "path";

export async function libraryGenerator(tree: Tree, options: LibrarySchema) {
  const projectDir = `${options.projectRoot}/${options.name}`;

  generateFiles(tree, path.join(__dirname, "files"), projectDir, {
    ...options,
    tmpl: "",
  });

  await formatFiles(tree);
}
```

Template files:

```
tools/generators/lib/files/
├── src/
│   ├── index.ts.tmpl
│   └── lib.spec.ts.tmpl
├── package.json.tmpl
└── project.json.tmpl
```

### Migration Generators

Automated code upgrades:

```bash
nx generate @mycompany/generators:migrate-v2
# Applies breaking change migrations across workspace
```

## Nx Cloud Setup

### Local Setup

```bash
# Authenticate with Nx Cloud
nx connect

# Configure in nx.json
{
  "nxCloudAccessToken": "your-token-here",
  "tasksRunnerOptions": {
    "default": {
      "runner": "nx-cloud",
      "options": {
        "accessToken": "your-token-here",
        "cacheableOperations": ["build", "test", "lint"],
        "parallel": 4
      }
    }
  }
}
```

### GitHub Actions Integration

```yaml
name: CI

on:
  push:
    branches: [main]
  pull_request:

jobs:
  test:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
        with:
          fetch-depth: 0

      - uses: actions/setup-node@v4
        with:
          node-version: 18
          cache: "npm"

      - run: npm ci

      - name: Test affected projects
        run: npx nx affected -t test --base=origin/main
        env:
          NX_CLOUD_ACCESS_TOKEN: ${{ secrets.NX_CLOUD_ACCESS_TOKEN }}

      - name: Build affected projects
        run: npx nx affected -t build --base=origin/main
```

### Caching Strategy

Nx Cloud caches:
- Task outputs (dist/, coverage/, etc.)
- Computation hashes for dependency graphs
- Distributed task execution results

Configure cache inputs in `nx.json`:

```json
{
  "targetDefaults": {
    "build": {
      "inputs": [
        "production",
        "^production"
      ],
      "outputs": ["{projectRoot}/dist"],
      "cache": true
    }
  },
  "namedInputs": {
    "production": [
      "!{projectRoot}/**/*.spec.ts",
      "!{projectRoot}/**/*.test.ts",
      "!{projectRoot}/README.md"
    ]
  }
}
```

## Migration Patterns

### From uv Workspaces (Python)

Nx has limited Python support. For polyglot setups:

```json
{
  "projects": {
    "api": {
      "root": "apps/api",
      "targets": {
        "test": {
          "executor": "nx:run-commands",
          "options": {
            "command": "cd apps/api && pytest"
          }
        }
    }
  }
}
```

### From Turborepo

Migrate turbo.json to nx.json:

```javascript
// turbo.json
{
  "tasks": {
    "build": {
      "dependsOn": ["^build"],
      "outputs": ["dist/**"]
    }
  }
}

// Translates to nx.json
{
  "targetDefaults": {
    "build": {
      "dependsOn": ["^build"],
      "outputs": ["{projectRoot}/dist"],
      "cache": true
    }
  }
}
```

### Incremental Migration

1. Create nx.json with basic configuration
2. Run `nx init` to auto-detect projects
3. Add project.json files to each package
4. Enable generators for consistency
5. Integrate Nx Cloud for CI caching

```bash
# Initialize Nx in existing monorepo
nx init

# Detect and configure projects
nx repair

# Verify graph
nx graph
```

## IDE Integration

### VS Code Setup

Install Nx Console extension for:
- Interactive command palette
- Dependency graph visualization
- Script execution
- Generator scaffolding

```json
{
  "recommendations": [
    "nrwl.angular-console"
  ]
}
```

### IDE Awareness

Configure path mappings for IDE auto-import:

```json
{
  "compilerOptions": {
    "baseUrl": ".",
    "paths": {
      "@company/lib-shared": ["packages/shared/src"],
      "@company/lib-models": ["packages/models/src"],
      "@company/*": ["packages/*/src"]
    }
  }
}
```

## CI/CD Patterns

### Parallel Task Execution

```bash
# Run tests, lint, and typecheck in parallel
nx affected -t test,lint,typecheck --base=origin/main --parallel=4

# With Nx Cloud distributed execution
nx affected -t build --base=origin/main --parallel=8 --nxCloud
```

### Deployment Patterns

```bash
# Build only what changed
nx affected -t build --base=origin/main --production

# Deploy specific projects
nx run api:build && nx run api:deploy
nx run web:build && nx run web:deploy

# Sequential deployments with dependencies
nx affected -t deploy --base=origin/main --topological
```

### Branch Deployment Strategy

```yaml
jobs:
  build:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4

      - name: Determine affected
        id: affected
        run: |
          affected=$(npx nx affected --base=origin/main --plain)
          echo "projects=$affected" >> $GITHUB_OUTPUT

      - name: Build affected
        run: npx nx affected -t build --base=origin/main

      - name: Deploy to staging
        if: github.event_name == 'pull_request'
        run: npx nx affected -t deploy --base=origin/main --configuration=staging

      - name: Deploy to production
        if: github.ref == 'refs/heads/main'
        run: npx nx affected -t deploy --base=HEAD~1 --configuration=production
```

## Common Commands

### Task Execution

```bash
# Run task on single project
nx run api:build

# Run task on multiple projects
nx run-many -t build --projects=api,web

# Run affected by changes
nx affected -t build --base=origin/main

# Run with configuration
nx run api:build --configuration=production

# Watch mode
nx run api:serve --watch

# Parallel execution
nx run-many -t test --parallel=4
```

### Querying and Visualization

```bash
# List all projects
nx list

# Show project graph
nx graph

# Export graph as JSON
nx graph --file=graph.json

# Show affected projects
nx affected:graph --base=origin/main

# List targets for project
nx show project api --web
```

### Debugging and Analysis

```bash
# Show computation hash
nx affected -t build --base=origin/main --verbose

# Nx console with UI
nx console

# Profile build performance
nx affected -t build --base=origin/main --stats

# Verbose output
nx affected -t test --base=origin/main -v --stats
```

## Troubleshooting

### Dependency Inference Issues

**Problem**: Missing dependency between projects
```
Solution: Verify import paths match project names
         Run nx repair to regenerate project configs
         Check that projects are in npm workspace
         Verify tsconfig paths are configured correctly
```

**Problem**: Circular dependency detected
```
Solution: Review project imports
         Use nx graph to visualize relationships
         Refactor shared code into separate lib
         Check for implicit inter-project dependencies
```

### Task Execution Issues

**Problem**: Tasks not using cache
```
Solution: Verify cacheableOperations includes task
         Check inputs/outputs in targetDefaults
         Review namedInputs patterns
         Clear cache: nx reset
```

**Problem**: Wrong cache being used
```
Solution: Verify Nx Cloud token is correct
         Check tasksRunnerOptions configuration
         Run with --skip-nx-cache to bypass
         Inspect cache: nx cache query
```

### Generator Issues

**Problem**: Generator not found
```
Solution: Verify plugin is installed
         Check npm packages for @nx/* generators
         List available: nx list
         Run specific: nx list @nx/react
```

**Problem**: Generated code has import errors
```
Solution: Update path mappings in tsconfig
         Run nx repair
         Check generator options
         Review template files
```

## Advanced Topics

### Custom Executors

Create workspace-specific task executors:

```typescript
// tools/executors/custom/index.ts
import { ExecutorContext } from "@nx/devkit";

export default async function runExecutor(
  options: any,
  context: ExecutorContext
) {
  console.log("Custom executor running...");
  return { success: true };
}
```

Register in project.json:

```json
{
  "targets": {
    "custom": {
      "executor": "tools:custom"
    }
  }
}
```

### Task Dependencies

Configure complex task pipelines:

```json
{
  "targetDefaults": {
    "e2e": {
      "dependsOn": ["build"],
      "inputs": ["production"]
    },
    "deploy": {
      "dependsOn": ["test", "build"],
      "outputs": ["dist/metadata.json"]
    }
  }
}
```

### Constraining Dependencies

Enforce architectural boundaries:

```json
{
  "constrainedTo": [
    {
      "sourceTag": "scope:web",
      "onlyDependsOn": ["scope:web", "scope:shared"]
    },
    {
      "sourceTag": "scope:api",
      "onlyDependsOn": ["scope:api", "scope:shared"]
    },
    {
      "sourceTag": "type:app",
      "onlyDependsOn": ["type:lib", "type:app"]
    }
  ]
}
```

Validate with:

```bash
nx affected:dep-graph --check
```

## Key Resources

- **Official Documentation**: https://nx.dev/
- **Nx Cloud**: https://nx.app/
- **Plugin Catalog**: https://nx.dev/plugins
- **Nx Console**: https://marketplace.visualstudio.com/items?itemName=nrwl.angular-console
- **Community**: https://nx.dev/community
- **Blog**: https://blog.nrwl.io/
