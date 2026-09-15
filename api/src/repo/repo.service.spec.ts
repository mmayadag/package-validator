import { NotFoundException, UnprocessableEntityException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Test } from '@nestjs/testing';
import { DependencyCheckerService } from '../dependencies/dependency-checker.service.js';
import { EmailService } from '../email/email.service.js';
import { GithubService } from '../github/github.service.js';
import { type Subscription, SubscriptionsRepository } from '../subscriptions/subscriptions.repository.js';
import { RepoService } from './repo.service.js';

const ref = { owner: 'mmayadag', repo: 'package-validator' };
const stored = (overrides: Partial<Subscription> = {}): Subscription => ({
  id: 7,
  ...ref,
  email: 'dev@example.com',
  periodHours: 12,
  token: 'secret-token',
  createdAt: 0,
  confirmedAt: null,
  lastSentAt: null,
  ...overrides,
});

describe('RepoService', () => {
  const github = { repositoryExists: vi.fn(), getPackageJson: vi.fn() };
  const dependencyChecker = { findOutdated: vi.fn() };
  const email = { sendReport: vi.fn(), sendConfirmation: vi.fn() };
  const subscriptions = { upsert: vi.fn(), markSent: vi.fn(), deleteByToken: vi.fn(), confirm: vi.fn(), findByToken: vi.fn() };
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
  });

  describe('subscribe', () => {
    const request = { ...ref, email: 'dev@example.com', period: 12 };

    it('asks a new address to confirm instead of sending the report', async () => {
      givenRepositoryWithPackageJson();
      subscriptions.upsert.mockReturnValue(stored());
      email.sendConfirmation.mockResolvedValue(true);

      const result = await service.subscribe(request);

      expect(subscriptions.upsert).toHaveBeenCalledWith({ ...ref, email: 'dev@example.com', periodHours: 12 });
      expect(email.sendConfirmation).toHaveBeenCalledWith(
        'dev@example.com',
        ref,
        12,
        'https://pv.example.com/?confirm=secret-token',
      );
      expect(email.sendReport).not.toHaveBeenCalled();
      expect(subscriptions.markSent).not.toHaveBeenCalled();
      expect(result.emailSent).toBe(true);
      expect(result.subscription).toEqual({ status: 'pending', periodHours: 12, nextReportAt: null });
      expect(result.html).toBeDefined();
    });

    it('sends the report right away to an already confirmed address', async () => {
      givenRepositoryWithPackageJson();
      subscriptions.upsert.mockReturnValue(stored({ confirmedAt: 1 }));
      subscriptions.findByToken.mockReturnValue(stored({ confirmedAt: 1, lastSentAt: 3_600_000 }));
      email.sendReport.mockResolvedValue(true);

      const result = await service.subscribe(request);

      expect(email.sendConfirmation).not.toHaveBeenCalled();
      expect(email.sendReport).toHaveBeenCalledWith(
        'dev@example.com',
        ref,
        expect.objectContaining({ text: expect.any(String) }),
        'https://pv.example.com/?unsubscribe=secret-token',
      );
      expect(subscriptions.markSent).toHaveBeenCalledWith(7);
      expect(result.subscription).toEqual({
        status: 'active',
        periodHours: 12,
        nextReportAt: new Date(13 * 3_600_000).toISOString(),
      });
    });

    it('does not record a delivery when the email could not be sent', async () => {
      givenRepositoryWithPackageJson();
      subscriptions.upsert.mockReturnValue(stored({ confirmedAt: 1 }));
      subscriptions.findByToken.mockReturnValue(stored({ confirmedAt: 1 }));
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

  describe('confirm', () => {
    it('activates the subscription and sends the first report', async () => {
      givenRepositoryWithPackageJson();
      subscriptions.confirm.mockReturnValue(stored({ confirmedAt: 5 }));
      subscriptions.findByToken.mockReturnValue(stored({ confirmedAt: 5, lastSentAt: 5 }));
      email.sendReport.mockResolvedValue(true);

      const result = await service.confirm('secret-token');

      expect(subscriptions.confirm).toHaveBeenCalledWith('secret-token');
      expect(email.sendReport).toHaveBeenCalledWith('dev@example.com', ref, expect.anything(), expect.stringContaining('unsubscribe='));
      expect(subscriptions.markSent).toHaveBeenCalledWith(7);
      expect(result).toEqual({ ...ref, email: 'dev@example.com', subscription: { status: 'active', periodHours: 12, nextReportAt: expect.any(String) } });
    });

    it('does not resend the report when confirming twice', async () => {
      subscriptions.confirm.mockReturnValue(stored({ confirmedAt: 5, lastSentAt: 5 }));
      subscriptions.findByToken.mockReturnValue(stored({ confirmedAt: 5, lastSentAt: 5 }));

      await service.confirm('secret-token');

      expect(github.repositoryExists).not.toHaveBeenCalled();
      expect(email.sendReport).not.toHaveBeenCalled();
    });

    it('still activates when the repository has disappeared since', async () => {
      github.repositoryExists.mockResolvedValue(false);
      subscriptions.confirm.mockReturnValue(stored({ confirmedAt: 5 }));
      subscriptions.findByToken.mockReturnValue(stored({ confirmedAt: 5 }));

      const result = await service.confirm('secret-token');

      expect(result.subscription.status).toBe('active');
      expect(email.sendReport).not.toHaveBeenCalled();
    });

    it('rejects an unknown or expired token', async () => {
      subscriptions.confirm.mockReturnValue(null);

      await expect(service.confirm('unknown')).rejects.toBeInstanceOf(NotFoundException);
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
