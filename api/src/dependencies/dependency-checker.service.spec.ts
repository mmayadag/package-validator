import ncu from 'npm-check-updates';
import { DependencyCheckerService, groupBySection } from './dependency-checker.service.js';

vi.mock('npm-check-updates', () => ({ default: { run: vi.fn() } }));

describe('groupBySection', () => {
  it('keeps only upgraded packages, grouped by the section that declares them', () => {
    const manifest = {
      dependencies: { express: '^4.0.0', lodash: '^4.17.21' },
      devDependencies: { typescript: '^5.0.0' },
    };

    expect(groupBySection(manifest, { express: '^5.1.0', typescript: '^6.0.3' })).toEqual({
      dependencies: [{ name: 'express', current: '^4.0.0', latest: '^5.1.0' }],
      devDependencies: [{ name: 'typescript', current: '^5.0.0', latest: '^6.0.3' }],
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
      dependencies: [{ name: 'express', current: '^4.0.0', latest: '^5.1.0' }],
    });
  });
});
