import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import sgMail from '@sendgrid/mail';
import type { AppConfig } from '../config/configuration.js';
import {
  formatPeriod,
  type OutdatedDependencies,
  type ReportPeriod,
  type RepositoryRef,
} from '@package-validator/contracts';
import { escapeHtml, renderReport, type RenderedReport } from '../report/render-report.js';

export function withUnsubscribeFooter(report: RenderedReport, url: string): RenderedReport {
  return {
    html:
      `${report.html}\n` +
      '<p style="color:#6b7280;font-size:12px">You receive this report because you subscribed to it. ' +
      `<a href="${escapeHtml(url)}">Unsubscribe</a>.</p>`,
    text: `${report.text}\n\nUnsubscribe: ${url}`,
  };
}

export function confirmationMessage({ owner, repo }: RepositoryRef, periodHours: number, url: string): RenderedReport {
  const title = `${owner}/${repo}`;
  const period = formatPeriod(periodHours as ReportPeriod);
  return {
    html:
      `<p>Someone asked to receive the dependency report for <strong>${escapeHtml(title)}</strong> ` +
      `at this address every ${period}.</p>` +
      `<p><a href="${escapeHtml(url)}">Confirm the subscription</a></p>` +
      '<p style="color:#6b7280;font-size:12px">If that was not you, ignore this email; the request expires in 24 hours.</p>',
    text:
      `Someone asked to receive the dependency report for ${title} at this address every ${period}.\n\n` +
      `Confirm the subscription: ${url}\n\n` +
      'If that was not you, ignore this email; the request expires in 24 hours.',
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
  sendReport(
    to: string,
    ref: RepositoryRef,
    outdated: OutdatedDependencies,
    links?: { page: string; oneClick: string },
  ): Promise<boolean> {
    const report = renderReport(ref, outdated);
    const message = links ? withUnsubscribeFooter(report, links.page) : report;
    const headers = links
      ? {
          'List-Unsubscribe': `<${links.oneClick}>`,
          'List-Unsubscribe-Post': 'List-Unsubscribe=One-Click',
        }
      : undefined;
    return this.send(to, `${ref.owner}/${ref.repo} ${this.settings.subject}`, message, headers);
  }

  /** Asks the address owner to confirm a new subscription. */
  sendConfirmation(to: string, ref: RepositoryRef, periodHours: number, confirmUrl: string): Promise<boolean> {
    const message = confirmationMessage(ref, periodHours, confirmUrl);
    return this.send(to, `Confirm your ${ref.owner}/${ref.repo} ${this.settings.subject.toLowerCase()}`, message);
  }

  private async send(
    to: string,
    subject: string,
    { html, text }: RenderedReport,
    headers?: Record<string, string>,
  ): Promise<boolean> {
    if (!this.enabled || !this.settings.from) {
      this.logger.warn('SENDGRID_API_KEY or EMAIL_FROM is not set; skipping the email');
      return false;
    }

    try {
      await sgMail.send({ to, from: this.settings.from, subject, html, text, ...(headers ? { headers } : {}) });
      return true;
    } catch (error) {
      this.logger.error(`Could not send "${subject}": ${String(error)}`);
      return false;
    }
  }
}
