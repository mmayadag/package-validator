# Package Validator API

NestJS service that reads a public repository's `package.json` through the GitHub GraphQL API, compares every dependency with the npm registry and returns a report of what is outdated. Subscribers get the report by email.

## Modules

| Module | Responsibility |
|---|---|
| `config` | Loads and validates environment variables into a typed `AppConfig` |
| `github` | GraphQL client: repository lookup and `HEAD:package.json` contents |
| `dependencies` | Runs `npm-check-updates` on the manifest in memory and groups results by section |
| `report` | Renders the HTML and plain-text report, escaping every value |
| `email` | Sends the report with SendGrid, including an unsubscribe link; a no-op when it is not configured |
| `subscriptions` | SQLite storage for report subscriptions (`node:sqlite`, no native dependency) |
| `repo` | HTTP routes and the use cases that tie the modules together |
| `health` | `GET /health` liveness probe |

## Endpoints

| Method | Path | Body | Success | Errors |
|---|---|---|---|---|
| `GET` | `/health` | | `200 { status: "ok" }` | |
| `GET` | `/repo/isValid/:owner/:repo` | | `200 { valid }` | `400` invalid name |
| `POST` | `/repo/isValid` | `{ owner, repo }` | `200 { valid }` | `400` invalid body |
| `GET` | `/repo/details/:owner/:repo` | | `200` report | `404` unknown repo, `422` no or invalid `package.json` |
| `POST` | `/repo/schedule` | `{ owner, repo, email, period: 6 \| 12 \| 24 }` | `200` report, `emailSent`, `subscription` | `400`, `404`, `422` |
| `DELETE` | `/repo/subscriptions/:token` | | `204` | `400` malformed token, `404` unknown token |

A report looks like this:

```json
{
  "owner": "mmayadag",
  "repo": "bicycle-in-izmir",
  "outdated": {
    "dependencies": [{ "name": "express", "current": "^4.17.1", "latest": "^5.1.0" }]
  },
  "html": "<table>…</table>",
  "text": "Outdated dependencies of mmayadag/bicycle-in-izmir …"
}
```

### Subscriptions

`POST /repo/schedule` stores one subscription per email and repository (case-insensitive); posting again only changes the period. The response adds `subscription: { periodHours, nextReportAt }`, where `nextReportAt` stays `null` until a report has been delivered.

Every email links to `PUBLIC_URL/?unsubscribe=<token>`. The UI asks for confirmation and then calls `DELETE /repo/subscriptions/:token`, so mail scanners that follow links cannot unsubscribe anyone. The token is never returned by the API.

An hourly job (`@nestjs/schedule`) emails every subscription whose period has elapsed, so a report arrives within an hour of being due. A repository that fails (deleted, made private, no `package.json`) is logged and retried on the next run without blocking the others, and overlapping runs are skipped. Nothing is sent while SendGrid is not configured.

## Configuration

| Variable | Required | Default | Description |
|---|---|---|---|
| `TOKEN` | yes | | GitHub token used for the GraphQL API |
| `GITHUB_ENDPOINT` | no | `https://api.github.com/graphql` | GraphQL endpoint (GitHub Enterprise) |
| `SENDGRID_API_KEY` | no | | Enables email reports together with `EMAIL_FROM` |
| `EMAIL_FROM` | no | | Verified sender address |
| `EMAIL_SUBJECT` | no | `Dependency report` | Appended to `owner/repo` in the subject |
| `PUBLIC_URL` | no | `http://localhost:8080` | Address of the UI, used for unsubscribe links |
| `DATABASE_PATH` | no | `data/package-validator.db` | SQLite file for subscriptions (`:memory:` for tests) |
| `PORT` | no | `3288` | HTTP port |
| `CORS_ORIGIN` | no | | Comma-separated origins; CORS stays off when unset |

Invalid values stop the application at startup. `.env` is read from `api/` and from the repository root.

## Development

Requires Node.js 24.15+ and Yarn 1.

```bash
yarn install
yarn start:dev      # http://localhost:3288, watch mode
yarn lint           # oxlint
yarn typecheck      # tsc --noEmit
yarn test           # unit tests (Vitest)
yarn test:e2e       # HTTP tests with GitHub, npm and SendGrid mocked
yarn build          # dist/
```

The project is native ESM (`"type": "module"`, `module: nodenext`), so relative imports carry a `.js` extension.
