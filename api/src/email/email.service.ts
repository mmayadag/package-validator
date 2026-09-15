import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import sgMail from '@sendgrid/mail';
import type { AppConfig } from '../config/configuration.js';
import type { RepositoryRef } from '../github/github.service.js';
import { escapeHtml, type RenderedReport } from '../report/render-report.js';

export function withUnsubscribeFooter(report: RenderedReport, url: string): RenderedReport {
  return {
    html:
      `${report.html}\n` +
      '<p style="color:#6b7280;font-size:12px">You receive this report because you subscribed to it. ' +
      `<a href="${escapeHtml(url)}">Unsubscribe</a>.</p>`,
    text: `${report.text}\n\nUnsubscribe: ${url}`,
  };
}

@Injectable()
export class EmailService {
  private readonly logger = new Logger(EmailService.name);
  private readonly settings: AppConfig['email'];

  constructor(config: ConfigService<AppConfig, true>) {
    this.settings = config.get('email', { infer: true });
    if (this.settings.apiKey) {
      sgMail.setApiKey(this.settings.apiKey);
    }
  }

  get enabled(): boolean {
    return Boolean(this.settings.apiKey && this.settings.from);
  }

  /** Sends the report; returns whether it was sent. A delivery failure never fails the request. */
  async sendReport(
    to: string,
    { owner, repo }: RepositoryRef,
    report: RenderedReport,
    unsubscribeUrl?: string,
  ): Promise<boolean> {
    if (!this.enabled || !this.settings.from) {
      this.logger.warn('SENDGRID_API_KEY or EMAIL_FROM is not set; skipping the email report');
      return false;
    }

    const { html, text } = unsubscribeUrl ? withUnsubscribeFooter(report, unsubscribeUrl) : report;
    try {
      await sgMail.send({
        to,
        from: this.settings.from,
        subject: `${owner}/${repo} ${this.settings.subject}`,
        html,
        text,
      });
      return true;
    } catch (error) {
      this.logger.error(`Could not send the report for ${owner}/${repo}: ${String(error)}`);
      return false;
    }
  }
}
