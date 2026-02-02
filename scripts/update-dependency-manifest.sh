#!/bin/bash
# Update dependency manifest file
# Run this after adding/removing plugin dependencies

set -e

REPO_ROOT="$(git rev-parse --show-toplevel)"
cd "$REPO_ROOT"

echo "Updating dependency manifest..."

if ! command -v bun &> /dev/null; then
    echo "Error: Bun is required to run this script"
    echo "Install: brew install oven-sh/bun/bun"
    exit 1
fi

# Generate manifest
bun run scripts/validate-dependencies.ts --json > dependencies.json

echo "✅ Manifest updated: dependencies.json"
echo ""
echo "Summary:"
echo "  Total dependencies: $(jq -r '.summary.totalDependencies' dependencies.json)"
echo "  Satisfied: $(jq -r '.summary.satisfied' dependencies.json)"
echo "  Missing: $(jq -r '.summary.missing' dependencies.json)"
echo "  Runtimes: $(jq -r '.summary.runtimes | join(", ")' dependencies.json)"
