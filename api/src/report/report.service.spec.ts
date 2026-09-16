import { NotFoundException, UnprocessableEntityException } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import { DependencyCheckerService } from '../dependencies/dependency-checker.service.js';
import { GithubService } from '../github/github.service.js';
import { REPORT_CACHE_TTL_MS, ReportService } from './report.service.js';

const ref = { owner: 'mmayadag', repo: 'package-validator' };

describe('ReportService', () => {
  const github = { repositoryExists: vi.fn(), getPackageJson: vi.fn() };
  const dependencyChecker = { findOutdated: vi.fn() };
  let service: ReportService;

  beforeEach(async () => {
    vi.resetAllMocks();
    const moduleRef = await Test.createTestingModule({
      providers: [
        ReportService,
        { provide: GithubService, useValue: github },
        { provide: DependencyCheckerService, useValue: dependencyChecker },
      ],
    }).compile();
    service = moduleRef.get(ReportService);
  });

  const givenRepositoryWithPackageJson = (raw = '{}') => {
    github.repositoryExists.mockResolvedValue(true);
    github.getPackageJson.mockResolvedValue(raw);
    dependencyChecker.findOutdated.mockResolvedValue({});
  };

  it('builds a report from the outdated dependencies', async () => {
    givenRepositoryWithPackageJson('{"dependencies":{"express":"^4.0.0"}}');
    dependencyChecker.findOutdated.mockResolvedValue({
      dependencies: [{ name: 'express', current: '^4.0.0', latest: '^5.1.0', change: 'major' }],
    });

    const report = await service.buildReport(ref);

    expect(dependencyChecker.findOutdated).toHaveBeenCalledWith({ dependencies: { express: '^4.0.0' } });
    expect(report).toMatchObject({ ...ref, outdated: { dependencies: [{ name: 'express' }] } });
    expect(report.html).toContain('<td>express</td>');
  });

  it('rejects an unknown repository before reading any file', async () => {
    github.repositoryExists.mockResolvedValue(false);

    await expect(service.buildReport(ref)).rejects.toBeInstanceOf(NotFoundException);
    expect(github.getPackageJson).not.toHaveBeenCalled();
  });

  it('rejects a repository without package.json', async () => {
    github.repositoryExists.mockResolvedValue(true);
    github.getPackageJson.mockResolvedValue(null);

    await expect(service.buildReport(ref)).rejects.toBeInstanceOf(UnprocessableEntityException);
  });

  it.each(['not json', '[]', 'null'])('rejects package.json content %j', async (raw) => {
    github.repositoryExists.mockResolvedValue(true);
    github.getPackageJson.mockResolvedValue(raw);

    await expect(service.buildReport(ref)).rejects.toThrow('package.json is not valid JSON');
  });

  describe('cache', () => {
    beforeEach(() => vi.useFakeTimers());
    afterEach(() => vi.useRealTimers());

    it('reuses a report for an hour regardless of name casing', async () => {
      givenRepositoryWithPackageJson();

      const first = await service.buildReport(ref);
      vi.advanceTimersByTime(REPORT_CACHE_TTL_MS - 1);
      const second = await service.buildReport({ owner: 'MMayadag', repo: 'Package-Validator' });

      expect(second).toBe(first);
      expect(github.getPackageJson).toHaveBeenCalledTimes(1);
      expect(dependencyChecker.findOutdated).toHaveBeenCalledTimes(1);
      expect(first.generatedAt).toBe(new Date(Date.now() - REPORT_CACHE_TTL_MS + 1).toISOString());
    });

    it('rebuilds the report once the hour has passed', async () => {
      givenRepositoryWithPackageJson();

      await service.buildReport(ref);
      vi.advanceTimersByTime(REPORT_CACHE_TTL_MS);
      await service.buildReport(ref);

      expect(github.getPackageJson).toHaveBeenCalledTimes(2);
    });

    it('rebuilds after the cache is cleared', async () => {
      givenRepositoryWithPackageJson();

      await service.buildReport(ref);
      service.clearCache();
      await service.buildReport(ref);

      expect(github.getPackageJson).toHaveBeenCalledTimes(2);
    });

    it('does not cache failures', async () => {
      github.repositoryExists.mockResolvedValueOnce(false);
      await expect(service.buildReport(ref)).rejects.toBeInstanceOf(NotFoundException);
      givenRepositoryWithPackageJson();

      await expect(service.buildReport(ref)).resolves.toMatchObject(ref);
    });
  });
});
