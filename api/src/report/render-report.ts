import type { OutdatedDependencies } from '../dependencies/dependency-checker.service.js';
import type { RepositoryRef } from '../github/github.service.js';

export interface RenderedReport {
  html: string;
  text: string;
}

export function renderReport({ owner, repo }: RepositoryRef, outdated: OutdatedDependencies): RenderedReport {
  const sections = Object.entries(outdated);
  const title = `${owner}/${repo}`;

  if (sections.length === 0) {
    const message = `All dependencies of ${title} are up to date.`;
    return { html: `<p>${message}</p>`, text: message };
  }

  const html = sections
    .map(([section, packages]) => {
      const rows = packages
        .map(
          ({ name, current, latest }) =>
            `<tr><td>${name}</td><td>${current}</td><td>${latest}</td></tr>`,
        )
        .join('');
      return (
        `<table><caption>${section}</caption>` +
        '<thead><tr><th>package</th><th>current</th><th>latest</th></tr></thead>' +
        `<tbody>${rows}</tbody></table>`
      );
    })
    .join('\n');

  const text = sections
    .map(([section, packages]) =>
      [section, ...packages.map(({ name, current, latest }) => `  ${name}: ${current} -> ${latest}`)].join('\n'),
    )
    .join('\n\n');

  return { html, text: `Outdated dependencies of ${title}\n\n${text}` };
}
