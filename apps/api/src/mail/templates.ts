export type MailTemplate =
  | 'signup-received'
  | 'signup-existing-account'
  | 'approved'
  | 'password-reset'
  | 'email-change-otp'
  | 'email-changed'
  | 'grading-notification'
  | 'teacher-pending-summary';

export interface RenderedMail {
  subject: string;
  html: string;
  text: string;
}

export function escapeHtml(str: string): string {
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}

export function renderTemplate(template: MailTemplate, variables: Record<string, unknown>): RenderedMail {
  switch (template) {
    case 'signup-received': {
      const subject = 'Recibimos tu solicitud en Englove';
      const text =
        'Recibimos tu solicitud en Englove.\n\nTu cuenta está pendiente de aprobación por parte de tu profesora. Te avisaremos por este medio en cuanto puedas ingresar.';
      const html = `<!DOCTYPE html><html><body>
        <h2>Recibimos tu solicitud en Englove</h2>
        <p>Tu cuenta está pendiente de aprobación por parte de tu profesora. Te avisaremos por este medio en cuanto puedas ingresar.</p>
        <p style="color: #666; font-size: 12px;">Englove — Plataforma de aprendizaje de inglés.</p>
      </body></html>`;
      return { subject, html, text };
    }

    case 'signup-existing-account': {
      const rawRecoveryUrl = String(variables.recoveryUrl || '/recuperar-contrasena');
      const recoveryUrl = escapeHtml(rawRecoveryUrl);
      const subject = 'Ya tienes una cuenta en Englove';
      const text = `Ya tienes una cuenta en Englove.\n\nPuedes ingresar o solicitar el restablecimiento de tu contraseña en: ${rawRecoveryUrl}\nSi no intentaste registrarte, puedes ignorar este mensaje.`;
      const html = `<!DOCTYPE html><html><body>
        <h2>Ya tienes una cuenta en Englove</h2>
        <p>Intentaste registrarte con este correo, pero ya existe una cuenta asociada en la plataforma.</p>
        <p>Si olvidaste tu contraseña, puedes restablecerla en el siguiente enlace:</p>
        <p><a href="${recoveryUrl}">Restablecer contraseña</a></p>
        <p>Si no realizaste esta solicitud, puedes ignorar este mensaje con seguridad.</p>
        <p style="color: #666; font-size: 12px;">Englove — Plataforma de aprendizaje de inglés.</p>
      </body></html>`;
      return { subject, html, text };
    }

    case 'approved': {
      const rawLoginUrl = String(variables.loginUrl || '/login');
      const loginUrl = escapeHtml(rawLoginUrl);
      const subject = 'Tu cuenta de Englove fue aprobada';
      const text = `¡Buenas noticias! Tu cuenta de Englove fue aprobada.\n\nYa puedes ingresar con las credenciales que elegiste al registrarte en: ${rawLoginUrl}`;
      const html = `<!DOCTYPE html><html><body>
        <h2>¡Tu cuenta fue aprobada!</h2>
        <p>Tu profesora ha aprobado tu solicitud de registro en Englove.</p>
        <p>Ya puedes acceder a la plataforma con las credenciales que elegiste al registrarte:</p>
        <p><a href="${loginUrl}">Iniciar sesión en Englove</a></p>
        <p style="color: #666; font-size: 12px;">Englove — Plataforma de aprendizaje de inglés.</p>
      </body></html>`;
      return { subject, html, text };
    }

    case 'password-reset': {
      const rawResetUrl = String(variables.resetUrl || '');
      const resetUrl = escapeHtml(rawResetUrl);
      const subject = 'Restablece tu contraseña de Englove';
      const text = `Restablece tu contraseña de Englove.\n\nUsa el siguiente enlace para crear una nueva contraseña: ${rawResetUrl}\nEste enlace es de un solo uso y expirará en 30 minutos.`;
      const html = `<!DOCTYPE html><html><body>
        <h2>Restablecimiento de contraseña</h2>
        <p>Recibimos una solicitud para restablecer tu contraseña de Englove.</p>
        <p><a href="${resetUrl}">Crear nueva contraseña</a></p>
        <p>Este enlace es de un solo uso y tiene una validez de 30 minutos.</p>
        <p style="color: #666; font-size: 12px;">Englove — Plataforma de aprendizaje de inglés.</p>
      </body></html>`;
      return { subject, html, text };
    }

    case 'email-change-otp': {
      const otp = String(variables.otp || '');
      const subject = 'Confirma tu nuevo correo en Englove';
      const text = `Confirma tu nuevo correo en Englove.\n\nTu código de verificación es: ${otp}\nEste código vence en 10 minutos. No compartas este código con nadie.`;
      const html = `<!DOCTYPE html><html><body>
        <h2>Confirmación de cambio de correo</h2>
        <p>Usa el siguiente código de 6 dígitos para confirmar tu nuevo correo electrónico en Englove:</p>
        <h3 style="letter-spacing: 4px; font-size: 24px;">${escapeHtml(otp)}</h3>
        <p>Este código es de un solo uso y vence en 10 minutos. No lo compartas con nadie.</p>
        <p style="color: #666; font-size: 12px;">Englove — Plataforma de aprendizaje de inglés.</p>
      </body></html>`;
      return { subject, html, text };
    }

    case 'email-changed': {
      const subject = 'Tu correo de acceso a Englove cambió';
      const text =
        'Aviso de seguridad: Tu correo de acceso a Englove ha sido actualizado.\n\nEste es un mensaje informativo de seguridad. Si no reconoces esta modificación, contacta de inmediato con el soporte del colegio.';
      const html = `<!DOCTYPE html><html><body>
        <h2>Aviso de seguridad</h2>
        <p>Te informamos que tu correo de acceso a Englove ha sido actualizado exitosamente.</p>
        <p>Si no realizaste este cambio, comunícate de inmediato con tu profesora o con el equipo de soporte.</p>
        <p style="color: #666; font-size: 12px;">Englove — Plataforma de aprendizaje de inglés.</p>
      </body></html>`;
      return { subject, html, text };
    }

    case 'grading-notification': {
      // NOTE: Strictly does NOT contain grade, score, answers, feedback or audio (RF-15, SPEC-01 §5)
      const activityTitle = escapeHtml(String(variables.activityTitle || 'Actividad'));
      const rawFeedbackUrl = String(variables.feedbackUrl || '/feedback');
      const feedbackUrl = escapeHtml(rawFeedbackUrl);
      const subject = 'Tu actividad ya fue calificada';
      const text = `Tu actividad "${variables.activityTitle || 'Actividad'}" ya fue calificada.\n\nEntra a Englove para consultar el resultado: ${rawFeedbackUrl}`;
      const html = `<!DOCTYPE html><html><body>
        <h2>Tu actividad ya fue calificada</h2>
        <p>Tu profesora ha revisado y calificado tu entrega para la actividad <strong>${activityTitle}</strong>.</p>
        <p><a href="${feedbackUrl}">Entra a Englove para consultar el resultado</a></p>
        <p style="color: #666; font-size: 12px;">Englove — Plataforma de aprendizaje de inglés.</p>
      </body></html>`;
      return { subject, html, text };
    }

    case 'teacher-pending-summary': {
      const pendingRequests = Number(variables.pendingRequests || 0);
      const ungradedActivities = Number(variables.ungradedActivities || 0);
      const subject = 'Tienes pendientes en Englove';
      const text = `Tienes pendientes en Englove:\n- Solicitudes de registro por revisar: ${pendingRequests}\n- Actividades sin calificar hace más de 3 días: ${ungradedActivities}\n\nIngresa al panel para gestionarlos.`;
      const html = `<!DOCTYPE html><html><body>
        <h2>Tienes pendientes en Englove</h2>
        <p>Resumen de tareas pendientes en la plataforma:</p>
        <ul>
          <li>Solicitudes de registro pendientes: <strong>${pendingRequests}</strong></li>
          <li>Actividades pendientes de revisión (>3 días): <strong>${ungradedActivities}</strong></li>
        </ul>
        <p><a href="/inicio">Ir al panel de control</a></p>
        <p style="color: #666; font-size: 12px;">Englove — Plataforma de aprendizaje de inglés.</p>
      </body></html>`;
      return { subject, html, text };
    }

    default:
      throw new Error(`Plantilla desconocida: ${template}`);
  }
}
