import type { ConfigService } from '@nestjs/config';
import sgMail from '@sendgrid/mail';
import type { AppConfig } from '../config/configuration.js';
import { EmailService } from './email.service.js';

vi.mock('@sendgrid/mail', () => ({ default: { setApiKey: vi.fn(), send: vi.fn() } }));

const configWith = (email: AppConfig['email']) => ({ get: () => email }) as unknown as ConfigService<AppConfig, true>;
const configured = { apiKey: 'SG.test', from: 'reports@example.com', subject: 'Dependency report' };
const ref = { owner: 'mmayadag', repo: 'package-validator' };
const report = { html: '<table></table>', text: 'report' };
const link = 'https://pv.example.com/?unsubscribe=abc';

const sentMessage = () => vi.mocked(sgMail.send).mock.calls[0][0] as unknown as { [key: string]: string };

describe('EmailService', () => {
  beforeEach(() => {
    vi.resetAllMocks();
  });

  it('does nothing when SendGrid is not configured', async () => {
    const service = new EmailService(configWith({ subject: 'Dependency report' }));

    expect(service.enabled).toBe(false);
    await expect(service.sendReport('dev@example.com', ref, report)).resolves.toBe(false);
    await expect(service.sendConfirmation('dev@example.com', ref, 24, link)).resolves.toBe(false);
    expect(sgMail.send).not.toHaveBeenCalled();
  });

  it('sends the report with an unsubscribe link', async () => {
    const service = new EmailService(configWith(configured));

    await expect(service.sendReport('dev@example.com', ref, report, link)).resolves.toBe(true);

    expect(sgMail.setApiKey).toHaveBeenCalledWith('SG.test');
    expect(sentMessage()).toMatchObject({
      to: 'dev@example.com',
      from: 'reports@example.com',
      subject: 'mmayadag/package-validator Dependency report',
    });
    expect(sentMessage().html).toContain(`<a href="${link}">Unsubscribe</a>`);
    expect(sentMessage().text).toContain(`Unsubscribe: ${link}`);
  });

  it('sends a confirmation request with the period and the link', async () => {
    const service = new EmailService(configWith(configured));
    const confirm = 'https://pv.example.com/?confirm=abc';

    await expect(service.sendConfirmation('dev@example.com', ref, 12, confirm)).resolves.toBe(true);

    expect(sentMessage().subject).toBe('Confirm your mmayadag/package-validator dependency report');
    expect(sentMessage().html).toContain('every 12 hours');
    expect(sentMessage().html).toContain(`<a href="${confirm}">Confirm the subscription</a>`);
    expect(sentMessage().text).toContain(`Confirm the subscription: ${confirm}`);
  });

  it('returns false instead of throwing when delivery fails', async () => {
    vi.mocked(sgMail.send).mockRejectedValue(new Error('SendGrid is down'));
    const service = new EmailService(configWith(configured));

    await expect(service.sendReport('dev@example.com', ref, report)).resolves.toBe(false);
  });
});
