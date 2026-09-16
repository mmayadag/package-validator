import type { OutdatedDependencies, OutdatedDependency, RepoReport, RepositoryRef } from '@package-validator/contracts';

export type RenderedReport = Pick<RepoReport, 'html' | 'text'>;

const HTML_ESCAPES: Record<string, string> = {
  '&': '&amp;',
  '<': '&lt;',
  '>': '&gt;',
  '"': '&quot;',
  "'": '&#39;',
};

/** Package names and ranges come from a third-party package.json, so they are never trusted as markup. */
export const escapeHtml = (value: string): string => value.replace(/[&<>"']/g, (char) => HTML_ESCAPES[char]);

const CHANGE_COLORS: Record<OutdatedDependency['change'], string> = {
  major: '#cf222e',
  minor: '#9a6700',
  patch: '#1a7f37',
  unknown: '#6b7280',
};

export function renderReport({ owner, repo }: RepositoryRef, outdated: OutdatedDependencies): RenderedReport {
  const sections = Object.entries(outdated);
  const title = `${owner}/${repo}`;

  if (sections.length === 0) {
    const message = `All dependencies of ${title} are up to date.`;
    return { html: `<p>${escapeHtml(message)}</p>`, text: message };
  }

  const packages = sections.flatMap(([, list]) => list);
  const majors = packages.filter(({ change }) => change === 'major').length;
  const summary =
    `${packages.length} outdated ${packages.length === 1 ? 'dependency' : 'dependencies'}` +
    (majors > 0 ? `, ${majors} with a major version jump` : '');

  const html =
    `<p>${escapeHtml(summary)}.</p>\n` +
    sections
      .map(([section, list]) => {
        const rows = list
          .map(
            ({ name, current, latest, change }) =>
              `<tr><td>${escapeHtml(name)}</td><td>${escapeHtml(current)}</td><td>${escapeHtml(latest)}</td>` +
              `<td style="color:${CHANGE_COLORS[change]}">${change}</td></tr>`,
          )
          .join('');
        return (
          `<table><caption>${escapeHtml(section)}</caption>` +
          '<thead><tr><th>package</th><th>current</th><th>latest</th><th>change</th></tr></thead>' +
          `<tbody>${rows}</tbody></table>`
        );
      })
      .join('\n');

  const text = sections
    .map(([section, list]) =>
      [
        section,
        ...list.map(({ name, current, latest, change }) => `  ${name}: ${current} -> ${latest} (${change})`),
      ].join('\n'),
    )
    .join('\n\n');

  return { html, text: `Outdated dependencies of ${title}: ${summary}\n\n${text}` };
}
