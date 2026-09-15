.DEFAULT_GOAL := help
.PHONY: help up down logs ps install test lint

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

install: ## Install api and ui dependencies
	cd api && yarn install --frozen-lockfile
	cd ui && npm ci --no-audit --no-fund

test: ## Run api unit + e2e tests and ui tests
	cd api && yarn test && yarn test:e2e
	cd ui && npm test

lint: ## Lint and type-check both apps
	cd api && yarn lint && yarn typecheck
	cd ui && npm run check

.env:
	cp .env.example .env
	@echo "Created .env from .env.example - set TOKEN to a GitHub token."
