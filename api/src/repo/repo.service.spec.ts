import { NotFoundException, UnprocessableEntityException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Test } from '@nestjs/testing';
import { DependencyCheckerService } from '../dependencies/dependency-checker.service.js';
import { EmailService } from '../email/email.service.js';
import { GithubService } from '../github/github.service.js';
import { SubscriptionsRepository } from '../subscriptions/subscriptions.repository.js';
import { RepoService } from './repo.service.js';

const ref = { owner: 'mmayadag', repo: 'package-validator' };

describe('RepoService', () => {
  const github = { repositoryExists: vi.fn(), getPackageJson: vi.fn() };
  const dependencyChecker = { findOutdated: vi.fn() };
  const email = { sendReport: vi.fn() };
  const subscriptions = { upsert: vi.fn(), markSent: vi.fn(), deleteByToken: vi.fn() };
  let service: RepoService;

  beforeEach(async () => {
    vi.resetAllMocks();
    const moduleRef = await Test.createTestingModule({
      providers: [
        RepoService,
        { provide: GithubService, useValue: github },
        { provide: DependencyCheckerService, useValue: dependencyChecker },
        { provide: EmailService, useValue: email },
        { provide: SubscriptionsRepository, useValue: subscriptions },
        { provide: ConfigService, useValue: { get: () => 'https://pv.example.com' } },
      ],
    }).compile();
    service = moduleRef.get(RepoService);
  });

  const givenRepositoryWithPackageJson = (raw = '{}') => {
    github.repositoryExists.mockResolvedValue(true);
    github.getPackageJson.mockResolvedValue(raw);
    dependencyChecker.findOutdated.mockResolvedValue({});
  };

  describe('buildReport', () => {
    it('builds a report from the outdated dependencies', async () => {
      givenRepositoryWithPackageJson('{"dependencies":{"express":"^4.0.0"}}');
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
  });

  describe('subscribe', () => {
    const request = { ...ref, email: 'dev@example.com', period: 12 };

    beforeEach(() => {
      subscriptions.upsert.mockReturnValue({ id: 7, periodHours: 12, token: 'secret-token' });
    });

    it('stores the subscription and emails the report with an unsubscribe link', async () => {
      givenRepositoryWithPackageJson();
      email.sendReport.mockResolvedValue(true);

      const result = await service.subscribe(request);

      expect(subscriptions.upsert).toHaveBeenCalledWith({ ...ref, email: 'dev@example.com', periodHours: 12 });
      expect(email.sendReport).toHaveBeenCalledWith(
        'dev@example.com',
        ref,
        expect.objectContaining({ text: expect.any(String) }),
        'https://pv.example.com/?unsubscribe=secret-token',
      );
      expect(subscriptions.markSent).toHaveBeenCalledWith(7, expect.any(Number));
      expect(result.emailSent).toBe(true);
      expect(result.subscription.periodHours).toBe(12);
      expect(Date.parse(result.subscription.nextReportAt ?? '')).toBeGreaterThan(Date.now() + 11 * 3_600_000);
    });

    it('keeps the subscription due when the email could not be sent', async () => {
      givenRepositoryWithPackageJson();
      email.sendReport.mockResolvedValue(false);

      const result = await service.subscribe(request);

      expect(subscriptions.markSent).not.toHaveBeenCalled();
      expect(result.subscription.nextReportAt).toBeNull();
    });

    it('does not store a subscription for an unknown repository', async () => {
      github.repositoryExists.mockResolvedValue(false);

      await expect(service.subscribe(request)).rejects.toBeInstanceOf(NotFoundException);
      expect(subscriptions.upsert).not.toHaveBeenCalled();
    });
  });

  describe('unsubscribe', () => {
    it('deletes the subscription', () => {
      subscriptions.deleteByToken.mockReturnValue(true);

      service.unsubscribe('secret-token');

      expect(subscriptions.deleteByToken).toHaveBeenCalledWith('secret-token');
    });

    it('rejects an unknown token', () => {
      subscriptions.deleteByToken.mockReturnValue(false);

      expect(() => service.unsubscribe('unknown')).toThrow(NotFoundException);
    });
  });
});
