# Migration Checklist

Comprehensive checklists for monorepo migrations.

## Polyrepo → Monorepo Migration

### Pre-Migration

- [ ] All source repositories backed up (push to secondary remote)
- [ ] Baseline metrics documented (CI time, test count, build size)
- [ ] Team consensus on target structure
- [ ] Dependency audit completed (identify conflicts)
- [ ] Rollback procedure documented and tested
- [ ] Timeline communicated to all teams

### During Migration

#### Per-Repository

- [ ] Clone source repo as mirror
- [ ] Filter to target subdirectory with git-filter-repo
- [ ] Namespace tags to avoid conflicts
- [ ] Merge with --allow-unrelated-histories
- [ ] Verify commit count matches original
- [ ] Remove temporary remote

#### Post-Repository Merge

- [ ] All git history present
- [ ] No merge conflict markers in files
- [ ] File structure matches target
- [ ] Tags accessible with namespace prefix

### Post-Migration

- [ ] All tests pass: `pytest packages/`
- [ ] Type checking passes: `mypy packages/`
- [ ] Linting passes: `black --check .`
- [ ] All internal imports updated (no path hacks)
- [ ] CI/CD pipeline configured and passing
- [ ] Documentation updated
- [ ] Old repositories archived as read-only
- [ ] Team training completed

---

## Stage 1 → Stage 2 Migration (Add Turborepo/Nx)

### Pre-Migration

- [ ] CI time baseline measured
- [ ] Turborepo or Nx chosen based on stack
- [ ] Configuration approach documented

### Installation

- [ ] Tool installed (npm/pnpm)
- [ ] Configuration file created (turbo.json or nx.json)
- [ ] Per-package configuration added if needed

### Validation

- [ ] Dry run shows correct task graph
- [ ] Affected-only detection works
- [ ] Cache hits verified on repeated runs
- [ ] CI time improved as expected

---

## Stage 2 → Stage 3 Migration (Adopt Pants)

### Pre-Migration

- [ ] Pants version selected
- [ ] Backend packages identified
- [ ] Dependencies exported for Pants lockfile
- [ ] BUILD file strategy planned

### Installation

- [ ] Pants installed
- [ ] pants.toml created with correct settings
- [ ] 3rdparty/python/ structure created
- [ ] Lock file generated

### BUILD Files

- [ ] `pants tailor ::` run
- [ ] Generated BUILD files reviewed
- [ ] Custom targets added where needed
- [ ] Dependency graph validated

### Testing

- [ ] `pants test packages/::` passes
- [ ] `pants check packages/::` passes
- [ ] Affected-only testing works
- [ ] CI time improved

### CI/CD

- [ ] GitHub Actions / GitLab CI updated
- [ ] Remote caching configured (optional)
- [ ] Old test commands removed

---

## Rollback Checklist

### Disable Turborepo/Nx

- [ ] Remove turbo.json or nx.json
- [ ] Update CI to use raw test commands
- [ ] Verify all tests still pass

### Disable Pants

- [ ] Archive pants.toml
- [ ] Restore uv.lock from git
- [ ] Update CI to use pytest
- [ ] Remove BUILD files if desired
- [ ] Verify all tests still pass

---

## Team Coordination Checklist

### Communication

- [ ] Decision document shared
- [ ] Rationale explained (velocity, reliability)
- [ ] Timeline and roles clarified
- [ ] Q&A session scheduled

### Training

- [ ] Workshop planned (2 hours)
- [ ] Documentation prepared
- [ ] Common issues documented
- [ ] Support channel established

### Cutover

- [ ] Parallel testing period (old + new)
- [ ] Gradual CI migration
- [ ] Monitoring for issues
- [ ] Celebration when complete
