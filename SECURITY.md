# Security Policy

## Supported versions

Only the latest commit on the default branch receives security fixes.

## Reporting a vulnerability

Please do not open a public issue. Use GitHub's private vulnerability reporting instead:
**Security → Report a vulnerability** on this repository.

Include the affected component (`api` or `ui`), steps to reproduce and the impact you observed.
You can expect an acknowledgement within a few days.

## Handling secrets

- `TOKEN` only needs read access to public repositories; use a fine-grained token with no extra scopes.
- Never commit `.env`. It is ignored by Git and excluded from the Docker build context.
