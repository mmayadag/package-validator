import {
  classifyChange,
  DependencyCheckerService,
  groupBySection,
  isRegistryRange,
  upgradeRange,
} from './dependency-checker.service.js';
import type { NpmRegistryClient } from './npm-registry.client.js';

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

describe('isRegistryRange', () => {
  it.each(['^4.0.0', '~1.2.3', '4.17.1', '>=1.0.0', '1.x', '>=1.0.0 <2.0.0', '1.0.0 || 2.0.0'])(
    'accepts %s',
    (range) => {
      expect(isRegistryRange(range)).toBe(true);
    },
  );

  it.each([
    '*',
    'x',
    'latest',
    '',
    'npm:string-width@^4.2.0',
    'git+https://github.com/user/repo.git',
    'git://github.com/user/repo.git',
    'github:user/repo',
    'user/repo',
    'https://example.com/pkg.tgz',
    'file:../local',
    'link:../local',
    'workspace:*',
    'not a range',
  ])('skips %s', (range) => {
    expect(isRegistryRange(range)).toBe(false);
  });
});

describe('upgradeRange', () => {
  it.each([
    ['^4.0.0', '5.1.0', '^5.1.0'],
    ['~1.2.0', '1.3.0', '~1.3.0'],
    ['4.17.1', '4.17.21', '4.17.21'],
    ['>=1.0.0', '2.0.0', '>=2.0.0'],
    ['^4', '5.1.0', '^5.1.0'],
    ['1.x', '2.0.0', '2.0.0'],
    ['>=1.0.0 <2.0.0', '2.0.0', '2.0.0'],
    ['^2.0.0-beta.1', '2.0.0-beta.3', '^2.0.0-beta.3'],
  ])('%s with latest %s becomes %s', (current, latest, expected) => {
    expect(upgradeRange(current, latest)).toBe(expected);
  });

  it.each([
    ['^5.1.0', '5.1.0'],
    ['^5.2.0', '5.1.0'],
    ['^2.0.0-beta.1', '1.9.0'],
    ['^5.0.0', '6.0.0-alpha.1'],
    ['github:user/repo', '2.0.0'],
  ])('leaves %s alone when latest is %s', (current, latest) => {
    expect(upgradeRange(current, latest)).toBeNull();
  });
});

describe('groupBySection', () => {
  it('keeps only outdated packages, grouped by the section that declares them, with the change kind', () => {
    const manifest = {
      dependencies: { express: '^4.0.0', lodash: '^4.17.21' },
      devDependencies: { typescript: '^5.0.0' },
    };
    const latest = new Map([
      ['express', '5.1.0'],
      ['lodash', '4.17.21'],
      ['typescript', '5.9.3'],
    ]);

    expect(groupBySection(manifest, latest)).toEqual({
      dependencies: [{ name: 'express', current: '^4.0.0', latest: '^5.1.0', change: 'major' }],
      devDependencies: [{ name: 'typescript', current: '^5.0.0', latest: '^5.9.3', change: 'minor' }],
    });
  });

  it('ignores packages the registry did not resolve and ranges it does not serve', () => {
    const manifest = { dependencies: { missing: '^1.0.0', local: 'file:../local' } };

    expect(groupBySection(manifest, new Map([['local', '9.9.9']]))).toEqual({});
  });

  it('returns an empty object when nothing is outdated', () => {
    expect(groupBySection({ dependencies: { lodash: '^4.17.21' } }, new Map([['lodash', '4.17.21']]))).toEqual({});
  });
});

describe('DependencyCheckerService', () => {
  it('asks the registry once per registry-hosted package across all sections', async () => {
    const registry = { latestVersions: vi.fn().mockResolvedValue(new Map([['express', '5.1.0']])) };
    const manifest = {
      dependencies: { express: '^4.0.0', local: 'file:../local' },
      devDependencies: { express: '^4.0.0', 'my-alias': 'npm:express@^4.0.0' },
    };

    const result = await new DependencyCheckerService(registry as unknown as NpmRegistryClient).findOutdated(manifest);

    expect(registry.latestVersions).toHaveBeenCalledWith(['express', 'express']);
    expect(result).toEqual({
      dependencies: [{ name: 'express', current: '^4.0.0', latest: '^5.1.0', change: 'major' }],
      devDependencies: [{ name: 'express', current: '^4.0.0', latest: '^5.1.0', change: 'major' }],
    });
  });
});
