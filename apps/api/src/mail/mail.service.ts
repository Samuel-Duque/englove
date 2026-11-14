import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Resend } from 'resend';
import { MailTemplate, renderTemplate } from './templates';

import * as net from 'node:net';

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
  private readonly smtpHost: string;
  private readonly smtpPort: number;

  constructor(private readonly configService: ConfigService) {
    this.appEnv = this.configService.get<string>('APP_ENV', 'local');
    this.mailFrom = this.configService.get<string>('MAIL_FROM', 'notificaciones@englove.org');
    this.smtpHost = this.configService.get<string>('SMTP_HOST', 'localhost');
    this.smtpPort = Number(this.configService.get<number>('SMTP_PORT', 1025));
    const resendApiKey = this.configService.get<string>('RESEND_API_KEY');

    if (resendApiKey && resendApiKey.trim() !== '') {
      this.resendClient = new Resend(resendApiKey);
    }
  }

  private sendSmtpLocal(params: {
    from: string;
    to: string;
    subject: string;
    html: string;
    text: string;
    template: string;
    idempotencyKey?: string;
  }): Promise<SendMailResult> {
    return new Promise((resolve) => {
      const socket = net.createConnection({ host: this.smtpHost, port: this.smtpPort });
      let resolved = false;

      const finish = (result: SendMailResult) => {
        if (!resolved) {
          resolved = true;
          try {
            socket.destroy();
          } catch {
            // Ignore socket destruction errors
          }
          resolve(result);
        }
      };

      socket.setTimeout(2000);
      socket.on('timeout', () => {
        this.logger.debug('[MailService:local] Mailpit timeout; fallback a log seguro sin PII');
        finish({
          status: 'logged',
          messageId: params.idempotencyKey || `local-${Date.now()}`,
        });
      });

      socket.on('error', (err) => {
        this.logger.debug(`[MailService:local] Mailpit no disponible (${err.message}); fallback a log seguro sin PII`);
        finish({
          status: 'logged',
          messageId: params.idempotencyKey || `local-${Date.now()}`,
        });
      });

      let state = 0;
      let buffer = '';

      socket.on('data', (chunk) => {
        buffer += chunk.toString();
        if (!buffer.endsWith('\n')) return;
        const lines = buffer.split(/\r?\n/).filter(Boolean);
        const lastLine = lines[lines.length - 1] || '';
        buffer = '';

        if (state === 0 && lastLine.startsWith('220')) {
          state = 1;
          socket.write('EHLO localhost\r\n');
        } else if (state === 1 && (lastLine.startsWith('250 ') || lastLine.startsWith('250-'))) {
          if (lastLine.startsWith('250 ')) {
            state = 2;
            socket.write(`MAIL FROM:<${params.from.replace(/.*<([^>]+)>.*/, '$1')}>\r\n`);
          }
        } else if (state === 2 && lastLine.startsWith('250')) {
          state = 3;
          socket.write(`RCPT TO:<${params.to}>\r\n`);
        } else if (state === 3 && lastLine.startsWith('250')) {
          state = 4;
          socket.write('DATA\r\n');
        } else if (state === 4 && lastLine.startsWith('354')) {
          state = 5;
          const msgId = `<${Date.now()}@englove.local>`;
          const boundary = `boundary_${Date.now()}`;
          const raw = [
            `From: ${params.from}`,
            `To: ${params.to}`,
            `Subject: ${params.subject}`,
            `Message-ID: ${msgId}`,
            'MIME-Version: 1.0',
            `Content-Type: multipart/alternative; boundary="${boundary}"`,
            '',
            `--${boundary}`,
            'Content-Type: text/plain; charset=utf-8',
            '',
            params.text,
            '',
            `--${boundary}`,
            'Content-Type: text/html; charset=utf-8',
            '',
            params.html,
            '',
            `--${boundary}--`,
            '.',
            '',
          ].join('\r\n');
          socket.write(raw);
        } else if (state === 5 && lastLine.startsWith('250')) {
          state = 6;
          socket.write('QUIT\r\n');
          const opId = params.idempotencyKey || `mailpit-${Date.now()}`;
          this.logger.log(`[MailService:mailpit] Correo entregado a Mailpit para plantilla '${params.template}'`);
          finish({ status: 'accepted', messageId: opId });
        } else if (lastLine.startsWith('4') || lastLine.startsWith('5')) {
          this.logger.warn(`[MailService:local] Error respuesta SMTP; fallback a log seguro`);
          finish({
            status: 'logged',
            messageId: params.idempotencyKey || `local-${Date.now()}`,
          });
        }
      });
    });
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

    // Local development mode: send via SMTP to Mailpit if available, otherwise log metadata without PII (RF-15, RF-16, Rule G-C10)
    if (this.appEnv === 'local' || !this.resendClient) {
      return this.sendSmtpLocal({
        from: this.mailFrom,
        to,
        subject,
        html,
        text,
        template,
        idempotencyKey,
      });
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
