import { describe, it, expect, vi } from 'vitest';
import { MailService } from '../src/mail/mail.service';
import { renderTemplate, escapeHtml, MailTemplate } from '../src/mail/templates';
import { ConfigService } from '@nestjs/config';

describe('RF-15: ocho plantillas cumplen contenido y privacidad', () => {
  const allTemplates: MailTemplate[] = [
    'signup-received',
    'signup-existing-account',
    'approved',
    'password-reset',
    'email-change-otp',
    'email-changed',
    'grading-notification',
    'teacher-pending-summary',
  ];

  it('renders all 8 canonical email templates with subject, html, and text in Spanish', () => {
    expect(allTemplates.length).toBe(8);

    for (const t of allTemplates) {
      const rendered = renderTemplate(t, {
        recoveryUrl: 'http://localhost:3000/recuperar-contrasena',
        loginUrl: 'http://localhost:3000/login',
        resetUrl: 'http://localhost:3000/restablecer/token123',
        otp: '123456',
        activityTitle: 'Listening practice 1',
        feedbackUrl: 'http://localhost:3000/feedback',
        pendingRequests: 2,
        ungradedActivities: 5,
      });

      expect(rendered.subject).toBeTruthy();
      expect(rendered.html).toBeTruthy();
      expect(rendered.text).toBeTruthy();
      expect(rendered.html).toContain('Englove');
    }
  });

  it('strictly excludes grade, score, answers, feedback or audio from grading-notification', () => {
    const rendered = renderTemplate('grading-notification', {
      activityTitle: 'Speaking test',
      feedbackUrl: 'http://localhost:3000/feedback',
      score: '4.8', // malicious attempt to pass score
      feedback: 'Excellent work', // malicious attempt to pass feedback
    });

    // Neither the subject, html, nor text may display the score or feedback text
    expect(rendered.subject).not.toContain('4.8');
    expect(rendered.html).not.toContain('4.8');
    expect(rendered.text).not.toContain('4.8');
    expect(rendered.html).not.toContain('Excellent work');
    expect(rendered.text).not.toContain('Excellent work');
    expect(rendered.subject).toBe('Tu actividad ya fue calificada');
  });

  it('escapes HTML special characters in dynamic variables to prevent injection', () => {
    const escaped = escapeHtml('<script>alert("xss")</script>&foo=\'bar\'');
    expect(escaped).not.toContain('<script>');
    expect(escaped).toContain('&lt;script&gt;');
    expect(escaped).toContain('&amp;foo=');
    expect(escaped).toContain('&#039;bar&#039;');
  });
});

describe('RF-16: log privado, error SDK y resumen skipped', () => {
  it('operates in local mode without calling external SDK and returns logged', async () => {
    const mockConfig = {
      get: vi.fn((key: string, defaultVal?: unknown) => {
        if (key === 'APP_ENV') return 'local';
        if (key === 'MAIL_FROM') return 'notificaciones@englove.org';
        return defaultVal;
      }),
    } as unknown as ConfigService;

    const mailService = new MailService(mockConfig);

    const result = await mailService.sendMail({
      template: 'signup-received',
      to: 'student@example.com',
      variables: {},
      idempotencyKey: 'idem-12345',
    });

    expect(result.status).toBe('logged');
    expect(result.messageId).toBe('idem-12345');
  });

  it('skips teacher-pending-summary when there are zero pending tasks', async () => {
    const mockConfig = {
      get: vi.fn((key: string, defaultVal?: unknown) => {
        if (key === 'APP_ENV') return 'local';
        return defaultVal;
      }),
    } as unknown as ConfigService;

    const mailService = new MailService(mockConfig);

    const result = await mailService.sendMail({
      template: 'teacher-pending-summary',
      to: 'teacher@englove.org',
      variables: {
        pendingRequests: 0,
        ungradedActivities: 0,
      },
    });

    expect(result.status).toBe('skipped');
  });
});
