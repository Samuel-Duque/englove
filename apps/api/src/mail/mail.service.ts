import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Resend } from 'resend';
import { MailTemplate, renderTemplate } from './templates';

export interface SendMailOptions {
  template: MailTemplate;
  to: string;
  variables: Record<string, unknown>;
  idempotencyKey?: string;
}

export type MailDeliveryStatus = 'logged' | 'accepted' | 'skipped' | 'failed';

export interface SendMailResult {
  status: MailDeliveryStatus;
  messageId?: string;
  error?: string;
}

@Injectable()
export class MailService {
  private readonly logger = new Logger(MailService.name);
  private readonly resendClient?: Resend;
  private readonly mailFrom: string;
  private readonly appEnv: string;

  constructor(private readonly configService: ConfigService) {
    this.appEnv = this.configService.get<string>('APP_ENV', 'local');
    this.mailFrom = this.configService.get<string>('MAIL_FROM', 'notificaciones@englove.org');
    const resendApiKey = this.configService.get<string>('RESEND_API_KEY');

    if (resendApiKey && resendApiKey.trim() !== '') {
      this.resendClient = new Resend(resendApiKey);
    }
  }

  async sendMail(options: SendMailOptions): Promise<SendMailResult> {
    const { template, to, variables, idempotencyKey } = options;

    // Special case for teacher pending summary: if zero pendings, skip delivery (RF-16)
    if (template === 'teacher-pending-summary') {
      const pendingRequests = Number(variables.pendingRequests || 0);
      const ungradedActivities = Number(variables.ungradedActivities || 0);
      if (pendingRequests === 0 && ungradedActivities === 0) {
        return { status: 'skipped' };
      }
    }

    const { subject, html, text } = renderTemplate(template, variables);

    // Local development mode: do not call Resend, log operational metadata only (RF-16, Rule G-C10)
    if (this.appEnv === 'local' || !this.resendClient) {
      const opId = idempotencyKey || 'local-' + Date.now();
      // Notice: we log template name and operational ID, NEVER recipient email, body, tokens or OTP (Rule G-C10)
      this.logger.log(`[MailService:local] Plantilla '${template}' procesada con id operativo ${opId}`);
      return {
        status: 'logged',
        messageId: opId,
      };
    }

    try {
      const res = await this.resendClient.emails.send(
        {
          from: this.mailFrom,
          to,
          subject,
          html,
          text,
        },
        idempotencyKey ? { idempotencyKey } : undefined,
      );

      if (res.error) {
        this.logger.warn(`[MailService:error] Fallo en envío de plantilla '${template}'`);
        return {
          status: 'failed',
          error: res.error.message,
        };
      }

      return {
        status: 'accepted',
        messageId: res.data?.id,
      };
    } catch {
      this.logger.error(`[MailService:exception] Excepción en transporte de correo para '${template}'`);
      return {
        status: 'failed',
        error: 'Transport error',
      };
    }
  }
}
