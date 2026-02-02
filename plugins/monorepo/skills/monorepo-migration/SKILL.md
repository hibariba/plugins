---
name: monorepo-migration
description: Migrate to monorepo or between monorepo tooling stages. Use for "migrate to monorepo", "convert polyrepo", "combine repositories", "upgrade from uv to Pants", "migrate pnpm to Nx", "Turborepo to Pants migration", "preserve git history", "consolidate dependencies", or "monorepo migration planning".
---

# Monorepo Migration

Guide migrations from polyrepo to monorepo and between monorepo tooling stages (uv → Pants, pnpm → Nx, etc.).

## Quick Navigation

- **Polyrepo → Monorepo** → [references/polyrepo-to-monorepo.md](references/polyrepo-to-monorepo.md)
- **Stage Upgrades** → [references/stage-upgrades.md](references/stage-upgrades.md)
- **Migration Checklist** → [references/migration-checklist.md](references/migration-checklist.md)

## Migration Types

### Type 1: Polyrepo → Monorepo

Combining multiple repositories into a single monorepo while preserving Git history.

**Key steps:**
1. Clone and filter each repo with `git-filter-repo`
2. Merge with `--allow-unrelated-histories`
3. Consolidate dependencies
4. Update CI/CD

### Type 2: Simple → Advanced Tooling

Upgrading from basic workspaces to build systems with affected-only testing.

```
Stage 1: uv/pnpm workspaces    → Stage 2: + Turborepo/Nx
Stage 2: Turborepo/Nx          → Stage 3: Pants/Bazel
```

## Polyrepo → Monorepo Migration

### Git History Preservation

**Critical**: Use `git-filter-repo` to preserve full commit history.

```bash
# Install
pip install git-filter-repo

# Clone source repo
git clone --mirror https://github.com/org/service-api service-api.git
git clone service-api.git service-api-filtered
cd service-api-filtered

# Move to subdirectory (preserves all history)
git filter-repo --to-subdirectory-filter packages/api

# Merge into monorepo
cd /path/to/monorepo
git remote add -f service-api /path/to/service-api-filtered
git merge service-api/main --allow-unrelated-histories \
  -m "Migrate service-api to monorepo packages/api"
git remote remove service-api
```

### Multi-Repository Migration Script

```bash
#!/bin/bash
SERVICES=("auth-service" "api-gateway" "processor")
MONOREPO_PATH="/path/to/monorepo"

for SERVICE in "${SERVICES[@]}"; do
  echo "Migrating $SERVICE..."

  # Clone and filter
  git clone --mirror "https://github.com/org/$SERVICE" "$SERVICE.git"
  git clone "$SERVICE.git" "$SERVICE-filtered"
  cd "$SERVICE-filtered"
  git filter-repo --to-subdirectory-filter "packages/$SERVICE"

  # Namespace tags to avoid conflicts
  for tag in $(git tag); do
    git tag "$SERVICE/$tag" "$tag"
    git tag -d "$tag"
  done
  cd ..

  # Merge into monorepo
  cd "$MONOREPO_PATH"
  git remote add -f "$SERVICE" "../$SERVICE-filtered"
  git merge "$SERVICE/main" --allow-unrelated-histories \
    -m "Migrate $SERVICE to monorepo"
  git remote remove "$SERVICE"
done
```

### Dependency Consolidation

After merging, unify dependencies:

```python
# Find conflicts across migrated packages
from collections import defaultdict

deps = defaultdict(list)
for pkg_file in glob("packages/*/pyproject.toml"):
    # Parse and collect all dependencies
    deps[pkg_name].append((service, version))

# Report conflicts
for pkg, versions in deps.items():
    if len(set(v[1] for v in versions)) > 1:
        print(f"Conflict: {pkg} has versions {versions}")
```

**Resolution strategies:**
- Use most recent version (if compatible)
- Use most constrained version (safest)
- Negotiate between teams

## Stage-to-Stage Migrations

### When to Migrate

| Trigger | Action |
|---------|--------|
| CI time > 15 min | Add Turborepo/Nx (Stage 2) |
| CI time > 30 min with caching | Adopt Pants (Stage 3) |
| Multi-language complexity | Adopt Pants or Bazel |
| Team size > 50 | Consider Stage 2+ |

### uv → Pants (Python)

**Step 1: Install Pants**

```bash
curl --proto '=https' --tlsv1.2 -fsSL \
  https://static.pantsbuild.org/setup/install-pants.sh | bash
```

**Step 2: Create pants.toml**

```toml
[GLOBAL]
pants_version = "2.30.0"
backend_packages = [
    "pants.backend.python",
    "pants.backend.python.lint.black",
    "pants.backend.python.typecheck.mypy",
    "pants.backend.python.testing.pytest",
]

[python]
interpreter_constraints = [">=3.11,<3.13"]
enable_resolves = true
default_resolve = "python-default"

[python.resolves]
python-default = "3rdparty/python/default.lock"

[source]
root_patterns = ["/packages/*", "/apps/*"]
```

**Step 3: Generate BUILD files**

```bash
pants tailor ::
# Auto-generates BUILD files for all Python packages
```

**Step 4: Run affected-only tests**

```bash
# Full suite
pants test packages/::

# Affected only (huge time savings)
pants --changed-since=origin/main --changed-dependents=transitive test
```

### pnpm → Nx (TypeScript)

**Step 1: Install Nx**

```bash
pnpm add -D nx@latest
npx nx init
```

**Step 2: Create project.json per package**

```json
{
  "name": "my-lib",
  "targets": {
    "build": {
      "executor": "nx:run-commands",
      "options": { "command": "pnpm build" }
    },
    "test": {
      "executor": "nx:run-commands",
      "options": { "command": "pnpm test" }
    }
  }
}
```

**Step 3: Run affected tests**

```bash
nx affected -t test --base=origin/main
```

### pnpm → Turborepo (Minimal config)

**Step 1: Install**

```bash
pnpm add -D turbo@latest
```

**Step 2: Create turbo.json**

```json
{
  "$schema": "https://turbo.build/schema.json",
  "tasks": {
    "build": { "outputs": ["dist/**"], "dependsOn": ["^build"] },
    "test": { "cache": true },
    "lint": { "cache": true }
  }
}
```

**Step 3: Run**

```bash
turbo test --filter='...[origin/main]'
```

## CI/CD Migration

### GitHub Actions: Before (pytest)

```yaml
- run: pytest packages/ -v
```

### GitHub Actions: After (Pants)

```yaml
- uses: pantsbuild/actions/init-pants@v5
- run: |
    pants --changed-since=origin/main \
          --changed-dependents=transitive \
          test
```

### GitHub Actions: After (Turborepo)

```yaml
- run: npx turbo test --filter='...[origin/main]'
```

## Remote Caching

Enable remote caching for maximum CI speedup:

**Pants (Depot/BuildBuddy):**
```toml
[GLOBAL]
remote_cache_read = true
remote_cache_write = true
remote_store_address = "grpcs://cache.depot.dev"
```

**Turborepo (Vercel):**
```bash
turbo login && turbo link
```

**Nx (Nx Cloud):**
```bash
nx connect
```

## Rollback Procedures

### Disable Stage 2 Tools

```bash
# Remove turbo.json or nx.json
rm turbo.json
# Fall back to raw pytest/pnpm
pytest packages/ -v
```

### Rollback Pants → uv

```bash
# Keep pants.toml but disable in CI
# Restore uv.lock from git
git restore uv.lock
# Resume with standard pytest
uv sync --frozen && pytest packages/
```

## Team Coordination

### Communication Timeline

| Week | Action |
|------|--------|
| 1 | Share decision doc, explain rationale |
| 2 | Training session on new tools |
| 3-4 | Migration with parallel testing |
| 5+ | Decommission old CI/CD |

### Rollback Safety

```bash
# Archive old repos as read-only
for repo in service-*/; do
  git remote set-url origin "$(git remote get-url origin)" --push-url "no-push"
done

# Partial rollback (single service)
git subtree split -P packages/service -b extract/service
git push ../service-backup extract/service:main
```

## Performance Expectations

| Migration | Before | After | Savings |
|-----------|--------|-------|---------|
| Polyrepo → uv | 25m | 25m | 0% (but unified) |
| uv → Turborepo | 25m | 8m | 68% |
| uv → Nx | 25m | 7m | 72% |
| Turborepo → Pants | 8m | 2m | 75% |

## Validation Checklist

### Before Merging

- [ ] All git history present (commit count matches)
- [ ] No merge conflict markers in source
- [ ] All tests pass
- [ ] All internal imports updated
- [ ] Tags namespaced to avoid conflicts

### After Merging

- [ ] `uv sync --all-packages` completes
- [ ] CI pipeline runs successfully
- [ ] Team can run individual package tests
- [ ] No circular dependency warnings

## Further Reading

- [references/polyrepo-to-monorepo.md](references/polyrepo-to-monorepo.md) — Full git-filter-repo guide
- [references/stage-upgrades.md](references/stage-upgrades.md) — Detailed stage migration paths
- [references/migration-checklist.md](references/migration-checklist.md) — Complete validation checklists
