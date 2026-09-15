import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import sgMail from '@sendgrid/mail';
import type { AppConfig } from '../config/configuration.js';
import type { RepositoryRef } from '../github/github.service.js';
import type { RenderedReport } from '../report/render-report.js';

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
  async sendReport(to: string, { owner, repo }: RepositoryRef, report: RenderedReport): Promise<boolean> {
    if (!this.enabled || !this.settings.from) {
      this.logger.warn('SENDGRID_API_KEY or EMAIL_FROM is not set; skipping the email report');
      return false;
    }

    try {
      await sgMail.send({
        to,
        from: this.settings.from,
        subject: `${owner}/${repo} ${this.settings.subject}`,
        html: report.html,
        text: report.text,
      });
      return true;
    } catch (error) {
      this.logger.error(`Could not send the report for ${owner}/${repo}: ${String(error)}`);
      return false;
    }
  }
}
