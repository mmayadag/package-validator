# Package Validator API

NestJS service that reads a public repository's `package.json` through the GitHub GraphQL API, compares every dependency with the npm registry and returns (optionally emails) a report of what is outdated.

## Modules

| Module | Responsibility |
|---|---|
| `config` | Loads and validates environment variables into a typed `AppConfig` |
| `github` | GraphQL client: repository lookup and `HEAD:package.json` contents |
| `dependencies` | Runs `npm-check-updates` on the manifest in memory and groups results by section |
| `report` | Renders the HTML and plain-text report, escaping every value |
| `email` | Sends the report with SendGrid; a no-op when it is not configured |
| `repo` | HTTP routes and the use case that ties the modules together |
| `health` | `GET /health` liveness probe |

## Endpoints

| Method | Path | Body | Success | Errors |
|---|---|---|---|---|
| `GET` | `/health` | | `200 { status: "ok" }` | |
| `GET` | `/repo/isValid/:owner/:repo` | | `200 { valid }` | `400` invalid name |
| `POST` | `/repo/isValid` | `{ owner, repo }` | `200 { valid }` | `400` invalid body |
| `GET` | `/repo/details/:owner/:repo` | | `200` report | `404` unknown repo, `422` no or invalid `package.json` |
| `POST` | `/repo/schedule` | `{ owner, repo, email, period: 6 \| 12 \| 24 }` | `200` report + `emailSent` | `400`, `404`, `422` |

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

`period` is validated and stored in the request contract; recurring delivery is not implemented yet, so the report is sent once.

## Configuration

| Variable | Required | Default | Description |
|---|---|---|---|
| `TOKEN` | yes | | GitHub token used for the GraphQL API |
| `GITHUB_ENDPOINT` | no | `https://api.github.com/graphql` | GraphQL endpoint (GitHub Enterprise) |
| `SENDGRID_API_KEY` | no | | Enables email reports together with `EMAIL_FROM` |
| `EMAIL_FROM` | no | | Verified sender address |
| `EMAIL_SUBJECT` | no | `Dependency report` | Appended to `owner/repo` in the subject |
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
yarn test:e2e       # HTTP tests with GitHub and npm mocked
yarn build          # dist/
```

The project is native ESM (`"type": "module"`, `module: nodenext`), so relative imports carry a `.js` extension.
