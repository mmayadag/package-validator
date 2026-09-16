import { GITHUB_OWNER_PATTERN, GITHUB_REPO_PATTERN, type RepositoryRef } from '@package-validator/contracts';

export type { RepositoryRef };

const OWNER = `(${GITHUB_OWNER_PATTERN})`;
// Lazy, so a trailing `.git` is not swallowed by the name.
const REPO = `(${GITHUB_REPO_PATTERN}?)`;

const PATTERNS = [
  new RegExp(`^(?:https?://)?(?:www\\.)?github\\.com/${OWNER}/${REPO}(?:\\.git)?/?$`),
  new RegExp(`^git@github\\.com:${OWNER}/${REPO}(?:\\.git)?$`),
  new RegExp(`^${OWNER}/${REPO}$`),
];

/** Accepts `owner/repo`, an HTTPS or SSH GitHub URL, with or without `.git`. */
export function parseRepository(input: string): RepositoryRef | null {
  const value = input.trim();

  for (const pattern of PATTERNS) {
    const match = pattern.exec(value);
    if (match) {
      return { owner: match[1], repo: match[2] };
    }
  }

  return null;
}
