.PHONY: help install build dev test lint typecheck clean publish check-version bump-patch bump-minor bump-major tag release pre-commit

SHELL := /bin/bash

# Package info
PACKAGE_NAME := @tavor/sdk
VERSION_FILE := package.json
CURRENT_VERSION := $(shell node -p "require('./package.json').version" 2>/dev/null || echo "0.1.0")

# Colors
BLUE := \033[0;34m
GREEN := \033[0;32m
YELLOW := \033[0;33m
RED := \033[0;31m
NC := \033[0m # No Color

help: ## Show this help message
	@echo -e "${BLUE}Tavor JavaScript SDK - Available Commands${NC}"
	@echo -e "${BLUE}=========================================${NC}"
	@awk 'BEGIN {FS = ":.*##"; printf "\n"} /^[a-zA-Z_-]+:.*?##/ { printf "  ${GREEN}%-15s${NC} %s\n", $$1, $$2 }' $(MAKEFILE_LIST)
	@echo ""

install: ## Install dependencies
	@echo -e "${BLUE}Installing dependencies...${NC}"
	bun install
	@echo -e "${GREEN}✓ Dependencies installed${NC}"

build: ## Build the library
	@echo -e "${BLUE}Building library...${NC}"
	bun run build
	@echo -e "${GREEN}✓ Build complete${NC}"

dev: ## Run build in watch mode
	@echo -e "${BLUE}Starting development mode...${NC}"
	bun run dev

test: ## Run tests
	@echo -e "${BLUE}Running tests...${NC}"
	bun test

test-watch: ## Run tests in watch mode
	bun test --watch

lint: ## Run linting
	@echo -e "${BLUE}Running linter...${NC}"
	bun run lint

lint-fix: ## Run linting with auto-fix
	@echo -e "${BLUE}Running linter with auto-fix...${NC}"
	bun run lint:fix

typecheck: ## Run type checking
	@echo -e "${BLUE}Running type check...${NC}"
	bun run typecheck

clean: ## Clean build artifacts
	@echo -e "${BLUE}Cleaning build artifacts...${NC}"
	rm -rf dist/ coverage/ node_modules/ *.tsbuildinfo bun.lockb
	@echo -e "${GREEN}✓ Clean complete${NC}"

check-version: ## Check current version
	@echo -e "${BLUE}Current version: ${GREEN}$(CURRENT_VERSION)${NC}"

bump-patch: ## Bump patch version (0.0.X)
	@$(MAKE) _bump TYPE=patch

bump-minor: ## Bump minor version (0.X.0)
	@$(MAKE) _bump TYPE=minor

bump-major: ## Bump major version (X.0.0)
	@$(MAKE) _bump TYPE=major

_bump:
	@echo -e "${BLUE}Bumping $(TYPE) version from $(CURRENT_VERSION)...${NC}"
	@NEW_VERSION=$$(node -p "const v='$(CURRENT_VERSION)'.split('.'); const major=parseInt(v[0]), minor=parseInt(v[1]), patch=parseInt(v[2]); if('$(TYPE)'=='major') { console.log((major+1)+'.0.0'); } else if('$(TYPE)'=='minor') { console.log(major+'.'+(minor+1)+'.0'); } else { console.log(major+'.'+minor+'.'+(patch+1)); }" | head -1); \
	echo -e "${BLUE}New version: ${GREEN}$$NEW_VERSION${NC}"; \
	node -e "const fs=require('fs'); const pkg=require('./package.json'); pkg.version='$$NEW_VERSION'; fs.writeFileSync('package.json', JSON.stringify(pkg, null, 2)+'\n');"; \
	echo -e "${GREEN}✓ Version bumped to $$NEW_VERSION${NC}"

tag: ## Create and push a git tag for the current version
	@echo -e "${BLUE}Creating tag v$(CURRENT_VERSION)...${NC}"
	git tag -a v$(CURRENT_VERSION) -m "Release v$(CURRENT_VERSION)"
	@echo -e "${GREEN}✓ Tag created${NC}"
	@echo -e "${BLUE}Pushing tag to origin...${NC}"
	git push origin v$(CURRENT_VERSION)
	@echo -e "${GREEN}✓ Tag pushed successfully${NC}"

pre-commit: lint typecheck test ## Run all checks before committing
	@echo -e "${GREEN}✓ All pre-commit checks passed!${NC}"

publish: clean install build test ## Publish to npm
	@echo -e "${BLUE}Publishing to npm...${NC}"
	bun publish
	@echo -e "${GREEN}✓ Package published to npm${NC}"

release: pre-commit check-version ## Full release process (test, build, tag, publish)
	@echo -e "${BLUE}Starting release process for version $(CURRENT_VERSION)...${NC}"
	@echo -e "${YELLOW}This will:${NC}"
	@echo "  1. Run all tests"
	@echo "  2. Build the package"
	@echo "  3. Create and push a git tag"
	@echo "  4. Publish to npm"
	@read -p "Continue? (y/N) " -n 1 -r; \
	echo; \
	if [[ $$REPLY =~ ^[Yy]$$ ]]; then \
		$(MAKE) tag; \
		$(MAKE) publish; \
		echo -e "${GREEN}✓ Release complete!${NC}"; \
		echo -e "${YELLOW}Next steps:${NC}"; \
		echo "  1. Create a release on GitHub for v$(CURRENT_VERSION)"; \
		echo "  2. The package is now available on npm as $(PACKAGE_NAME)@$(CURRENT_VERSION)"; \
	fi
