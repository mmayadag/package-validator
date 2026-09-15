.PHONY: up down logs ps

up: .env
	docker compose up -d --build

down:
	docker compose down

logs:
	docker compose logs -f

ps:
	docker compose ps

.env:
	cp .env.example .env
	@echo "Created .env from .env.example - set TOKEN to a GitHub token."
