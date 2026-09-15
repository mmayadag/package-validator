# Package Validator UI

Single-page front end built with Svelte 5 (runes), TypeScript and Vite.

## Structure

```
src/
├── main.ts                      # mounts the app
├── app.css                      # design tokens, light and dark
├── App.svelte                   # page layout
├── components/
│   ├── RepositoryCheck.svelte   # form: repository, email, period
│   └── ReportTable.svelte       # outdated dependencies per section
└── lib/
    ├── api.ts                   # typed client for the API
    └── git-url.ts               # owner/repo, HTTPS and SSH GitHub URLs
```

The report is rendered from the structured `outdated` data rather than from server-generated HTML.

## Development

Requires Node.js 24.15+.

```bash
npm ci
npm run dev       # http://localhost:5173, /repo is proxied to http://localhost:3288
npm run check     # svelte-check, fails on warnings
npm test          # Vitest
npm run build     # dist/
```

In Docker the bundle is served by Caddy, which also proxies `/repo/*` to the API container (see `Caddyfile`).
