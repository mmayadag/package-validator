# Package Validator API

A NestJS service that checks a GitHub repository's dependencies for newer versions. Works together with [package-validator-ui](https://github.com/mmayadag/package-validator-ui).

## How it works

1. Checks that the `owner/repo` exists through the GitHub GraphQL API.
2. Fetches the repository's `package.json` from the file tree.
3. Runs [`npm-check-updates`](https://github.com/raineorshine/npm-check-updates) on it and returns the packages that have newer versions.

Scheduled email reports (NestJS Schedule + SendGrid) are scaffolded in `src/tasks` but not finished yet.

## API

| Method | Endpoint | Body | Returns |
|---|---|---|---|
| `POST` | `/repo/isValid` | `{ "owner": "...", "repo": "..." }` | `{ "valid": boolean }` |
| `GET` | `/repo/details/:owner/:repo` | — | Outdated dependencies report |

## Tech

NestJS · TypeScript · GitHub GraphQL API (`graphql-request`) · npm-check-updates · SendGrid · Jest

## Running locally

```bash
yarn install
yarn start:dev     # watch mode
yarn test          # unit tests
```

Create a `.env` file:

```env
GITHUB_ENDPOINT=https://api.github.com/graphql
TOKEN=<github-token>
SENDGRID_API_KEY=<optional, for email reports>
EMAIL_FROM=
EMAIL_SUBJECT=
TEMP_PATH=./tmp
```

## License

MIT
