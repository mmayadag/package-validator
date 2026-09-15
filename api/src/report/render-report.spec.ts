import { escapeHtml, renderReport } from './render-report.js';

const ref = { owner: 'mmayadag', repo: 'package-validator' };

describe('renderReport', () => {
  it('renders one table per section', () => {
    const { html, text } = renderReport(ref, {
      dependencies: [{ name: 'express', current: '^4.0.0', latest: '^5.1.0' }],
      devDependencies: [{ name: 'vitest', current: '^1.0.0', latest: '^5.0.0' }],
    });

    expect(html).toContain('<caption>dependencies</caption>');
    expect(html).toContain('<td>express</td><td>^4.0.0</td><td>^5.1.0</td>');
    expect(html).toContain('<caption>devDependencies</caption>');
    expect(text).toContain('  vitest: ^1.0.0 -> ^5.0.0');
  });

  it('says so when nothing is outdated', () => {
    expect(renderReport(ref, {}).text).toBe('All dependencies of mmayadag/package-validator are up to date.');
  });

  it('escapes values taken from the repository', () => {
    const { html } = renderReport(ref, {
      dependencies: [{ name: '<img src=x onerror=alert(1)>', current: '1', latest: '2' }],
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
