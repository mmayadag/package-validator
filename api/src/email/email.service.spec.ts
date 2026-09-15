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

describe('EmailService', () => {
  beforeEach(() => {
    vi.resetAllMocks();
  });

  it('does nothing when SendGrid is not configured', async () => {
    const service = new EmailService(configWith({ subject: 'Dependency report' }));

    expect(service.enabled).toBe(false);
    await expect(service.sendReport('dev@example.com', ref, report)).resolves.toBe(false);
    expect(sgMail.send).not.toHaveBeenCalled();
  });

  it('sends the report with an unsubscribe link', async () => {
    const service = new EmailService(configWith(configured));

    await expect(service.sendReport('dev@example.com', ref, report, link)).resolves.toBe(true);

    expect(sgMail.setApiKey).toHaveBeenCalledWith('SG.test');
    const [message] = vi.mocked(sgMail.send).mock.calls[0] as unknown as [{ [key: string]: string }];
    expect(message).toMatchObject({
      to: 'dev@example.com',
      from: 'reports@example.com',
      subject: 'mmayadag/package-validator Dependency report',
    });
    expect(message.html).toContain(`<a href="${link}">Unsubscribe</a>`);
    expect(message.text).toContain(`Unsubscribe: ${link}`);
  });

  it('returns false instead of throwing when delivery fails', async () => {
    vi.mocked(sgMail.send).mockRejectedValue(new Error('SendGrid is down'));
    const service = new EmailService(configWith(configured));

    await expect(service.sendReport('dev@example.com', ref, report)).resolves.toBe(false);
  });
});
