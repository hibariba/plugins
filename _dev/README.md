# Development-Only Artifacts

This directory and its contents exist **only on the `dev` branch**.

These files are excluded when merging to `main` to keep the published marketplace clean.

## What Goes Here

- `tests/` - Test suites and fixtures
- `scripts/` - Development scripts, automation
- `Makefile` - Development commands
- CI/CD configs that are dev-only
- Documentation drafts
- Debugging tools

## Why

The `main` branch is the **published marketplace** - users install from it.
It should contain only:
- Plugin code
- User-facing documentation
- Marketplace metadata

Development infrastructure adds noise and confusion for end users.
