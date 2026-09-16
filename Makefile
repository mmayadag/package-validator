.DEFAULT_GOAL := help
.PHONY: help up down logs ps install build test smoke lint format

help: ## List available targets
	@grep -E '^[a-z]+:.*## ' $(MAKEFILE_LIST) | awk -F ':.*## ' '{printf "  %-8s %s\n", $$1, $$2}'

up: .env ## Build the images and start the stack in the background
	docker compose up -d --build

down: ## Stop and remove the containers
	docker compose down

logs: ## Follow the logs of both containers
	docker compose logs -f

ps: ## Show container status
	docker compose ps

install: ## Install every workspace and build the shared contracts package
	npm ci --no-audit --no-fund
	npm run build:contracts

build: ## Build contracts, api and ui
	npm run build

test: ## Run api unit + e2e tests and ui tests
	npm test
	npm run test:e2e

smoke: ## Browser smoke test against the running stack (make up first; needs TOKEN in .env)
	npx playwright install chromium
	npm run test:smoke

lint: ## Format check, lint and type-check every workspace
	npm run format:check
	npm run lint
	npm run typecheck

format: ## Rewrite every file with prettier
	npm run format

.env:
	cp .env.example .env
	@echo "Created .env from .env.example - set TOKEN to a GitHub token."
