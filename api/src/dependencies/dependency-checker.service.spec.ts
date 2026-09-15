import ncu from 'npm-check-updates';
import { classifyChange, DependencyCheckerService, groupBySection } from './dependency-checker.service.js';

vi.mock('npm-check-updates', () => ({ default: { run: vi.fn() } }));

describe('classifyChange', () => {
  it.each([
    ['^4.0.0', '^5.1.0', 'major'],
    ['~4.17.0', '^4.18.2', 'minor'],
    ['4.17.1', '4.17.21', 'patch'],
    ['^0.3.1', '^0.5.1', 'major'],
    ['^0.3.1', '^0.3.9', 'patch'],
    ['^1.0.0', '^2.0.0-beta.1', 'major'],
    ['^1.2.0', '^1.3.0-rc.1', 'minor'],
    ['^1.0.0', '^1.0.0', 'unknown'],
    ['latest', '^2.0.0', 'unknown'],
    ['workspace:*', '^2.0.0', 'unknown'],
    ['github:user/repo', '^2.0.0', 'unknown'],
  ])('%s -> %s is %s', (current, latest, expected) => {
    expect(classifyChange(current, latest)).toBe(expected);
  });
});

describe('groupBySection', () => {
  it('keeps only upgraded packages, grouped by the section that declares them, with the change kind', () => {
    const manifest = {
      dependencies: { express: '^4.0.0', lodash: '^4.17.21' },
      devDependencies: { typescript: '^5.0.0' },
    };

    expect(groupBySection(manifest, { express: '^5.1.0', typescript: '^5.9.3' })).toEqual({
      dependencies: [{ name: 'express', current: '^4.0.0', latest: '^5.1.0', change: 'major' }],
      devDependencies: [{ name: 'typescript', current: '^5.0.0', latest: '^5.9.3', change: 'minor' }],
    });
  });

  it('returns an empty object when nothing is outdated', () => {
    expect(groupBySection({ dependencies: { lodash: '^4.17.21' } }, {})).toEqual({});
  });
});

describe('DependencyCheckerService', () => {
  it('passes the manifest to npm-check-updates without touching the filesystem', async () => {
    vi.mocked(ncu.run).mockResolvedValue({ express: '^5.1.0' });
    const manifest = { dependencies: { express: '^4.0.0' } };

    const result = await new DependencyCheckerService().findOutdated(manifest);

    expect(ncu.run).toHaveBeenCalledWith(
      expect.objectContaining({ packageData: JSON.stringify(manifest), jsonUpgraded: true }),
    );
    expect(result).toEqual({
      dependencies: [{ name: 'express', current: '^4.0.0', latest: '^5.1.0', change: 'major' }],
    });
  });
});
