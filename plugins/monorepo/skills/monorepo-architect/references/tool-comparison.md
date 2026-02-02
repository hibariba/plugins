# Stage 3: Advanced Build Systems

## Overview

Enterprise-scale monorepo tools with file-level dependency tracking, remote caching, and multi-language support.

**Migrate when:**
- CI times > 10 minutes
- > 20 packages
- > 50 developers
- Need file-level dependency graphs
- Multi-language coordination required

## Framework Comparison

| Factor | Pants | Bazel | Nx | Turborepo |
|--------|-------|-------|-----|-----------|
| **Primary Language** | Python | Multi-lang | TypeScript | TypeScript |
| **Learning Curve** | Moderate | Steep | Moderate | Gentle |
| **Setup Time** | 1-2 days | 1-2 weeks | 1 day | 2 hours |
| **Dependency Inference** | Automatic | Manual BUILD | Automatic | None |
| **File-level Tracking** | Yes | Yes | No | No |
| **Remote Caching** | REAPI | REAPI | Nx Cloud | Vercel/self-hosted |
| **Multi-language** | Excellent | Excellent | Limited | Limited |
| **IDE Support** | Good | Limited | Excellent | Good |
| **CI Integration** | Excellent | Excellent | Excellent | Excellent |
| **Ecosystem Maturity** | Growing | Mature | Mature | Growing |

## Decision Matrix

### Choose Pants When:
- **Python-centric** with some TypeScript/Go
- Want automatic dependency inference
- Need Docker integration with dependency tracking
- Team comfortable with Python tooling
- 20-500 packages
- CI times: 10-60 minutes

**Best for:** Python microservices, data platforms, ML pipelines

### Choose Bazel When:
- **Multi-language monorepo** (5+ languages)
- Billions of lines of code
- Need hermetic builds
- Remote build execution required
- Google-scale requirements
- 500+ packages

**Best for:** Very large enterprises, multi-platform products

### Choose Nx When:
- **TypeScript/JavaScript-centric**
- Want code generators and migrations
- Need excellent IDE integration
- Team prefers gentle learning curve
- 10-100 packages
- CI times: 5-30 minutes

**Best for:** Full-stack JavaScript apps, React/Angular projects

### Choose Turborepo When:
- **TypeScript-only or TypeScript-heavy**
- Want minimal configuration
- Need fast setup (< 2 hours)
- Using Vercel ecosystem
- 5-50 packages
- CI times: 5-20 minutes

**Best for:** Startups, Next.js apps, pnpm users

## Key Capabilities by Framework

### Pants

**Strengths:**
- Automatic Python import inference
- No manual BUILD file maintenance
- Native Docker support
- Incremental adoption (start with linting)
- Strong Python ecosystem

**Limitations:**
- Less mature than Bazel
- Smaller community
- TypeScript support experimental

**See:** [pants.md](pants.md)

### Bazel

**Strengths:**
- Battle-tested at Google scale
- True hermetic builds
- Remote execution support
- Universal dependency graph
- Multi-platform builds

**Limitations:**
- Steep learning curve
- Complex setup
- Poor IDE integration
- Manual BUILD file maintenance

**See:** [bazel.md](bazel.md)

### Nx

**Strengths:**
- Excellent developer experience
- Code generators (nx generate)
- Interactive dependency graph
- Migration scripts
- VSCode/WebStorm plugins

**Limitations:**
- JavaScript/TypeScript focused
- Package-level (not file-level) tracking
- Python support limited

**See:** [nx.md](nx.md)

### Turborepo

**Strengths:**
- Simplest setup
- Works with existing pnpm workspaces
- Free remote caching (Vercel)
- Minimal configuration
- Fast adoption

**Limitations:**
- No dependency inference
- Package-level only
- TypeScript-only
- Limited advanced features

**See:** [turborepo.md](turborepo.md)

## Common Patterns

### Affected-Only Testing

**Pants:**
```bash
./pants --changed-since=origin/main --changed-dependents=transitive test
```

**Bazel:**
```bash
bazel query "rdeps(//..., set($(git diff --name-only origin/main)))" | bazel test --
```

**Nx:**
```bash
nx affected -t test --base=origin/main
```

**Turborepo:**
```bash
turbo test --filter='...[origin/main]'
```

### Remote Caching

**Pants (REAPI):**
```toml
[GLOBAL]
remote_cache_read = true
remote_cache_write = true
remote_store_address = "grpcs://cache.depot.dev"
```

**Bazel (REAPI):**
```bazelrc
build --remote_cache=grpcs://cache.buildbuddy.io
build --remote_header=x-buildbuddy-api-key=YOUR_KEY
```

**Nx (Nx Cloud):**
```bash
nx connect
# Generates nx.json with cloud config
```

**Turborepo (Vercel):**
```bash
turbo login
turbo link
```

### Dependency Graph Visualization

**Pants:**
```bash
./pants dependencies --transitive services/api/src
./pants dependents libs/shared-core/src
```

**Bazel:**
```bash
bazel query "deps(//services/api:main)" --output graph | dot -Tpng > graph.png
```

**Nx:**
```bash
nx graph                    # Interactive browser
nx graph --file=graph.json  # Export
```

**Turborepo:**
```bash
turbo run build --graph=graph.pdf
```

## Migration Paths

### From uv → Pants
1. Add pants.toml with Python backend
2. Run `./pants tailor ::` to generate BUILD files
3. Start with formatting/linting (low risk)
4. Add testing
5. Add packaging/Docker

**Effort:** 1-2 weeks
**See:** [migration-stages.md](migration-stages.md#uv-to-pants)

### From pnpm → Nx
1. Install Nx: `pnpm add -D nx`
2. Run `pnpm exec nx init`
3. Configure nx.json and project.json
4. Migrate scripts to Nx targets

**Effort:** 2-3 days
**See:** [migration-stages.md](migration-stages.md#pnpm-to-nx)

### From pnpm → Turborepo
1. Install Turbo: `pnpm add -D turbo`
2. Create turbo.json
3. Update package.json scripts
4. Configure caching

**Effort:** 2-4 hours
**See:** [migration-stages.md](migration-stages.md#pnpm-to-turborepo)

### From Nx → Pants (polyglot)
1. Set up Pants with Python + JS backends
2. Map Nx projects to Pants targets
3. Migrate Python packages first
4. Keep Nx for TypeScript or migrate to Pants experimental JS

**Effort:** 2-4 weeks
**See:** [migration-stages.md](migration-stages.md#nx-to-pants)

### From Pants/Nx → Bazel
**Only if:**
- Need > 5 languages
- Require true hermetic builds
- Have dedicated build infrastructure team
- > 1000 packages

**Effort:** 2-6 months

## CI/CD Integration

All frameworks support:
- Affected-only testing
- Remote caching
- Distributed execution
- GitHub Actions, GitLab CI, CircleCI, Jenkins

**See framework-specific guides:**
- [pants.md#ci-integration](pants.md)
- [bazel.md#ci-integration](bazel.md)
- [nx.md#ci-integration](nx.md)
- [turborepo.md#ci-integration](turborepo.md)

## Cost Considerations

| Service | Free Tier | Pricing | Best For |
|---------|-----------|---------|----------|
| **BuildBuddy** | 10 GB cache | $50+/mo | Pants, Bazel |
| **EngFlow** | None | Enterprise | Large Bazel orgs |
| **Depot** | 50 GB cache | $10+/mo | Pants, Bazel |
| **Nx Cloud** | 500 CI runs/mo | $25+/mo | Nx |
| **Vercel Remote Cache** | Unlimited | Free | Turborepo |
| **Self-hosted** | Infrastructure cost | Free software | Any |

## Performance Benchmarks

Typical CI time improvements (vs naive full rebuild):

| Scenario | Before | After (with caching) | Improvement |
|----------|--------|---------------------|-------------|
| No changes | 15 min | 30 sec | 30x |
| 1 file changed | 15 min | 2 min | 7.5x |
| 10 files changed | 15 min | 5 min | 3x |
| Full rebuild | 15 min | 15 min (cached remote) | 1x local, ∞x team |

## Troubleshooting

| Issue | Pants | Bazel | Nx | Turborepo |
|-------|-------|-------|-----|-----------|
| Slow inference | Check `root_patterns` | N/A | N/A | N/A |
| Cache misses | Verify remote config | Check BUILD determinism | Verify nx.json | Check turbo.json |
| Missing deps | Run tailor | Update BUILD | Check project.json | Manual |
| IDE slow | Exclude .pants.d | Use aspect | Use Nx Console | N/A |

## Recommendations

**Startups/Small Teams (< 20 devs):**
- TypeScript: **Turborepo** (simplest)
- Python: **uv workspaces** (Stage 1)
- Polyglot: **uv + pnpm** (Stage 2)

**Mid-size Teams (20-100 devs):**
- TypeScript: **Nx** (better DX than Turborepo)
- Python: **Pants** (automatic inference)
- Polyglot: **Pants** (Python-heavy) or **Nx** (TS-heavy)

**Large Teams (100+ devs):**
- Python-centric: **Pants**
- Multi-language: **Bazel** (if team can handle complexity)
- TypeScript-centric: **Nx**

**When in doubt:** Start at Stage 1/2, measure CI pain, migrate when justified.
