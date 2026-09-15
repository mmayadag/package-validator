import { NotFoundException, UnprocessableEntityException } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import { DependencyCheckerService } from '../dependencies/dependency-checker.service.js';
import { EmailService } from '../email/email.service.js';
import { GithubService } from '../github/github.service.js';
import { RepoService } from './repo.service.js';

const ref = { owner: 'mmayadag', repo: 'package-validator' };

describe('RepoService', () => {
  const github = { repositoryExists: vi.fn(), getPackageJson: vi.fn() };
  const dependencyChecker = { findOutdated: vi.fn() };
  const email = { sendReport: vi.fn() };
  let service: RepoService;

  beforeEach(async () => {
    vi.resetAllMocks();
    const moduleRef = await Test.createTestingModule({
      providers: [
        RepoService,
        { provide: GithubService, useValue: github },
        { provide: DependencyCheckerService, useValue: dependencyChecker },
        { provide: EmailService, useValue: email },
      ],
    }).compile();
    service = moduleRef.get(RepoService);
  });

  it('builds a report from the outdated dependencies', async () => {
    github.repositoryExists.mockResolvedValue(true);
    github.getPackageJson.mockResolvedValue('{"dependencies":{"express":"^4.0.0"}}');
    dependencyChecker.findOutdated.mockResolvedValue({
      dependencies: [{ name: 'express', current: '^4.0.0', latest: '^5.1.0' }],
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

  it('emails the report and says whether it was sent', async () => {
    github.repositoryExists.mockResolvedValue(true);
    github.getPackageJson.mockResolvedValue('{}');
    dependencyChecker.findOutdated.mockResolvedValue({});
    email.sendReport.mockResolvedValue(true);

    const result = await service.sendReport(ref, 'dev@example.com');

    expect(email.sendReport).toHaveBeenCalledWith('dev@example.com', ref, expect.objectContaining({ text: expect.any(String) }));
    expect(result.emailSent).toBe(true);
  });
});
