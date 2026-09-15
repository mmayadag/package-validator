export interface RepositoryRef {
  owner: string;
  repo: string;
}

const OWNER = '([A-Za-z0-9](?:[A-Za-z0-9-]{0,38}))';
const REPO = '([A-Za-z0-9._-]{1,100}?)';

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
