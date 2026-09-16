import type { ConfigService } from '@nestjs/config';
import type { AppConfig } from '../config/configuration.js';
import type { EmailService } from '../email/email.service.js';
import type { ReportService } from '../report/report.service.js';
import { ReportSchedulerService } from './report-scheduler.service.js';
import type { Subscription, SubscriptionsRepository } from './subscriptions.repository.js';

const subscription = (overrides: Partial<Subscription>): Subscription => ({
  id: 1,
  owner: 'mmayadag',
  repo: 'package-validator',
  email: 'dev@example.com',
  periodHours: 6,
  token: 'token-1',
  createdAt: 0,
  confirmedAt: 0,
  lastSentAt: null,
  ...overrides,
});

describe('ReportSchedulerService', () => {
  const now = 1_000_000;
  const report = { owner: 'mmayadag', repo: 'package-validator', outdated: {}, html: '', text: '' };
  const reports = { buildReport: vi.fn() };
  const subscriptions = { findDue: vi.fn(), markSent: vi.fn(), deleteExpiredPending: vi.fn() };
  const email = { enabled: true, sendReport: vi.fn() };
  const config = { get: () => 'https://pv.example.com' };
  let scheduler: ReportSchedulerService;

  beforeEach(() => {
    vi.resetAllMocks();
    email.enabled = true;
    subscriptions.deleteExpiredPending.mockReturnValue(0);
    scheduler = new ReportSchedulerService(
      reports as unknown as ReportService,
      subscriptions as unknown as SubscriptionsRepository,
      email as unknown as EmailService,
      config as unknown as ConfigService<AppConfig, true>,
    );
  });

  it('only expires pending subscriptions while email delivery is not configured', async () => {
    email.enabled = false;
    subscriptions.deleteExpiredPending.mockReturnValue(3);

    await expect(scheduler.sendDueReports(now)).resolves.toEqual({ due: 0, sent: 0, failed: 0, expired: 3 });
    expect(subscriptions.deleteExpiredPending).toHaveBeenCalledWith(now);
    expect(subscriptions.findDue).not.toHaveBeenCalled();
  });

  it('emails every due subscription and records the delivery', async () => {
    subscriptions.findDue.mockReturnValue([
      subscription({ id: 1 }),
      subscription({ id: 2, repo: 'other', token: 'token-2' }),
    ]);
    reports.buildReport.mockResolvedValue(report);
    email.sendReport.mockResolvedValue(true);

    await expect(scheduler.sendDueReports(now)).resolves.toEqual({ due: 2, sent: 2, failed: 0, expired: 0 });

    expect(subscriptions.findDue).toHaveBeenCalledWith(now);
    expect(email.sendReport).toHaveBeenCalledWith(
      'dev@example.com',
      { owner: 'mmayadag', repo: 'other' },
      report,
      'https://pv.example.com/?unsubscribe=token-2',
    );
    expect(subscriptions.markSent).toHaveBeenCalledWith(1, now);
    expect(subscriptions.markSent).toHaveBeenCalledWith(2, now);
  });

  it('keeps going when one repository fails', async () => {
    subscriptions.findDue.mockReturnValue([subscription({ id: 1, repo: 'deleted' }), subscription({ id: 2 })]);
    reports.buildReport.mockRejectedValueOnce(new Error('not found')).mockResolvedValueOnce(report);
    email.sendReport.mockResolvedValue(true);

    await expect(scheduler.sendDueReports(now)).resolves.toEqual({ due: 2, sent: 1, failed: 1, expired: 0 });
    expect(subscriptions.markSent).toHaveBeenCalledTimes(1);
    expect(subscriptions.markSent).toHaveBeenCalledWith(2, now);
  });

  it('leaves a subscription due when the email could not be sent', async () => {
    subscriptions.findDue.mockReturnValue([subscription({})]);
    reports.buildReport.mockResolvedValue(report);
    email.sendReport.mockResolvedValue(false);

    await expect(scheduler.sendDueReports(now)).resolves.toEqual({ due: 1, sent: 0, failed: 1, expired: 0 });
    expect(subscriptions.markSent).not.toHaveBeenCalled();
  });

  it('skips a run while the previous one is still in progress', async () => {
    let finishBuild: (value: typeof report) => void = () => {};
    subscriptions.findDue.mockReturnValue([subscription({})]);
    reports.buildReport.mockReturnValue(new Promise((resolve) => (finishBuild = resolve)));
    email.sendReport.mockResolvedValue(true);

    const first = scheduler.sendDueReports(now);
    await expect(scheduler.sendDueReports(now)).resolves.toEqual({ due: 0, sent: 0, failed: 0, expired: 0 });

    finishBuild(report);
    await expect(first).resolves.toEqual({ due: 1, sent: 1, failed: 0, expired: 0 });
  });
});
