# Development Makefile - exists only on dev branch
# Run `make help` to see available commands

.PHONY: help test validate publish sync clean

# Default target
help:
	@echo "Plugin Marketplace Development Commands"
	@echo ""
	@echo "  make test       Run all tests"
	@echo "  make validate   Validate JSON files and plugin structure"
	@echo "  make publish    Merge dev to main (excludes dev artifacts)"
	@echo "  make sync       Pull latest from origin for both branches"
	@echo "  make clean      Remove build artifacts"
	@echo ""

# Run tests
test:
	@echo "Running tests..."
	@if [ -d "_dev/tests" ]; then \
		cd _dev/tests && bun test; \
	else \
		echo "No tests directory found"; \
	fi

# Validate all JSON and plugin structure
validate:
	@echo "Validating marketplace.json..."
	@jq empty .claude-plugin/marketplace.json && echo "✓ marketplace.json valid"
	@echo ""
	@echo "Validating plugin.json files..."
	@for f in plugins/*/.claude-plugin/plugin.json; do \
		if [ -f "$$f" ]; then \
			jq empty "$$f" && echo "✓ $$f valid"; \
		fi \
	done
	@echo ""
	@echo "Checking for secrets..."
	@gitleaks detect --source . --config gitleaks.toml --verbose

# Merge dev to main, excluding dev-only artifacts
publish:
	@echo "Publishing dev to main..."
	@echo ""
	@# Ensure we're on dev and it's clean
	@if [ "$$(git branch --show-current)" != "dev" ]; then \
		echo "Error: Must be on dev branch"; \
		exit 1; \
	fi
	@if [ -n "$$(git status --porcelain)" ]; then \
		echo "Error: Working directory not clean. Commit or stash changes first."; \
		exit 1; \
	fi
	@echo "Step 1: Checkout main..."
	@git checkout main
	@echo ""
	@echo "Step 2: Merge dev (no-commit to allow cleanup)..."
	@git merge dev --no-commit --no-ff || true
	@echo ""
	@echo "Step 3: Remove dev-only artifacts..."
	@while IFS= read -r pattern; do \
		case "$$pattern" in \
			''|\#*) continue ;; \
		esac; \
		rm -rf $$pattern 2>/dev/null || true; \
		git rm -rf --cached $$pattern 2>/dev/null || true; \
	done < _dev/.mainignore
	@echo ""
	@echo "Step 4: Commit clean merge..."
	@git add -A
	@git commit -m "chore: publish from dev (clean merge)"
	@echo ""
	@echo "Step 5: Push to origin..."
	@git push origin main
	@echo ""
	@echo "Step 6: Return to dev..."
	@git checkout dev
	@echo ""
	@echo "✓ Published to main successfully"

# Sync both branches with origin
sync:
	@echo "Syncing with origin..."
	@git fetch origin
	@git checkout main && git pull origin main
	@git checkout dev && git pull origin dev
	@echo "✓ Both branches synced"

# Clean build artifacts
clean:
	@echo "Cleaning..."
	@rm -rf coverage/ .nyc_output/ dist/ build/
	@echo "✓ Clean complete"
