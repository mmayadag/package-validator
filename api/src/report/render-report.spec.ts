import { escapeHtml, renderReport } from './render-report.js';

const ref = { owner: 'mmayadag', repo: 'package-validator' };

describe('renderReport', () => {
  it('renders one table per section with the change kind and a summary', () => {
    const { html, text } = renderReport(ref, {
      dependencies: [{ name: 'express', current: '^4.0.0', latest: '^5.1.0', change: 'major' }],
      devDependencies: [{ name: 'vitest', current: '^5.0.0', latest: '^5.0.1', change: 'patch' }],
    });

    expect(html).toContain('<p>2 outdated dependencies, 1 with a major version jump.</p>');
    expect(html).toContain('<caption>dependencies</caption>');
    expect(html).toContain('<td>express</td><td>^4.0.0</td><td>^5.1.0</td><td style="color:#cf222e">major</td>');
    expect(html).toContain('<caption>devDependencies</caption>');
    expect(text).toContain('Outdated dependencies of mmayadag/package-validator: 2 outdated dependencies, 1 with a major version jump');
    expect(text).toContain('  vitest: ^5.0.0 -> ^5.0.1 (patch)');
  });

  it('says so when nothing is outdated', () => {
    expect(renderReport(ref, {}).text).toBe('All dependencies of mmayadag/package-validator are up to date.');
  });

  it('escapes values taken from the repository', () => {
    const { html } = renderReport(ref, {
      dependencies: [{ name: '<img src=x onerror=alert(1)>', current: '1', latest: '2', change: 'unknown' }],
    });

    expect(html).not.toContain('<img');
    expect(html).toContain('&lt;img src=x onerror=alert(1)&gt;');
  });
});

describe('escapeHtml', () => {
  it('escapes all markup-significant characters', () => {
    expect(escapeHtml(`<a href="x">'&'</a>`)).toBe('&lt;a href=&quot;x&quot;&gt;&#39;&amp;&#39;&lt;/a&gt;');
  });
});
