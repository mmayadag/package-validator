import { NotFoundException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Test } from '@nestjs/testing';
import { EmailService } from '../email/email.service.js';
import { ReportService } from '../report/report.service.js';
import { SubscriptionService } from './subscription.service.js';
import { type Subscription, SubscriptionsRepository } from './subscriptions.repository.js';

const ref = { owner: 'mmayadag', repo: 'package-validator' };
const report = { ...ref, outdated: {}, generatedAt: '2026-09-16T00:00:00.000Z', html: '<table></table>', text: 'report' };
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

describe('SubscriptionService', () => {
  const reports = { buildReport: vi.fn() };
  const email = { sendReport: vi.fn(), sendConfirmation: vi.fn() };
  const subscriptions = { upsert: vi.fn(), markSent: vi.fn(), deleteByToken: vi.fn(), confirm: vi.fn(), findByToken: vi.fn() };
  let service: SubscriptionService;

  beforeEach(async () => {
    vi.resetAllMocks();
    reports.buildReport.mockResolvedValue(report);
    const moduleRef = await Test.createTestingModule({
      providers: [
        SubscriptionService,
        { provide: ReportService, useValue: reports },
        { provide: EmailService, useValue: email },
        { provide: SubscriptionsRepository, useValue: subscriptions },
        { provide: ConfigService, useValue: { get: () => 'https://pv.example.com' } },
      ],
    }).compile();
    service = moduleRef.get(SubscriptionService);
  });

  describe('subscribe', () => {
    const request = { ...ref, email: 'dev@example.com', period: 12 as const };

    it('asks a new address to confirm instead of sending the report', async () => {
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
      expect(result).toMatchObject({ ...report, emailSent: true });
      expect(result.subscription).toEqual({ status: 'pending', periodHours: 12, nextReportAt: null });
    });

    it('sends the report right away to an already confirmed address', async () => {
      subscriptions.upsert.mockReturnValue(stored({ confirmedAt: 1 }));
      subscriptions.findByToken.mockReturnValue(stored({ confirmedAt: 1, lastSentAt: 3_600_000 }));
      email.sendReport.mockResolvedValue(true);

      const result = await service.subscribe(request);

      expect(email.sendConfirmation).not.toHaveBeenCalled();
      expect(email.sendReport).toHaveBeenCalledWith(
        'dev@example.com',
        ref,
        report,
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
      subscriptions.upsert.mockReturnValue(stored({ confirmedAt: 1 }));
      subscriptions.findByToken.mockReturnValue(stored({ confirmedAt: 1 }));
      email.sendReport.mockResolvedValue(false);

      const result = await service.subscribe(request);

      expect(subscriptions.markSent).not.toHaveBeenCalled();
      expect(result.subscription.nextReportAt).toBeNull();
    });

    it('does not store a subscription for an unknown repository', async () => {
      reports.buildReport.mockRejectedValue(new NotFoundException());

      await expect(service.subscribe(request)).rejects.toBeInstanceOf(NotFoundException);
      expect(subscriptions.upsert).not.toHaveBeenCalled();
    });
  });

  describe('confirm', () => {
    it('activates the subscription and sends the first report', async () => {
      subscriptions.confirm.mockReturnValue(stored({ confirmedAt: 5 }));
      subscriptions.findByToken.mockReturnValue(stored({ confirmedAt: 5, lastSentAt: 5 }));
      email.sendReport.mockResolvedValue(true);

      const result = await service.confirm('secret-token');

      expect(subscriptions.confirm).toHaveBeenCalledWith('secret-token');
      expect(email.sendReport).toHaveBeenCalledWith('dev@example.com', ref, report, expect.stringContaining('unsubscribe='));
      expect(subscriptions.markSent).toHaveBeenCalledWith(7);
      expect(result).toEqual({ ...ref, email: 'dev@example.com', subscription: { status: 'active', periodHours: 12, nextReportAt: expect.any(String) } });
    });

    it('does not resend the report when confirming twice', async () => {
      subscriptions.confirm.mockReturnValue(stored({ confirmedAt: 5, lastSentAt: 5 }));
      subscriptions.findByToken.mockReturnValue(stored({ confirmedAt: 5, lastSentAt: 5 }));

      await service.confirm('secret-token');

      expect(reports.buildReport).not.toHaveBeenCalled();
      expect(email.sendReport).not.toHaveBeenCalled();
    });

    it('still activates when the repository has disappeared since', async () => {
      reports.buildReport.mockRejectedValue(new NotFoundException());
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
