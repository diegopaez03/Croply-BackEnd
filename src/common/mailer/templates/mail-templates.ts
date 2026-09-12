export interface MailTemplate {
  subject: string;
  html: string;
}

function wrap_html(title: string, body: string): string {
  return `<!DOCTYPE html>
<html lang="es">
  <head>
    <meta charset="utf-8" />
    <title>${title}</title>
  </head>
  <body style="font-family: Arial, sans-serif; color: #1f2937; line-height: 1.5; margin: 0; padding: 24px; background: #f7f4ef;">
    <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="max-width: 560px; margin: 0 auto; background: #ffffff; border-radius: 12px; padding: 32px;">
      <tr>
        <td>
          <h1 style="margin: 0 0 16px; font-size: 22px; color: #2f5d3a;">Croply</h1>
          ${body}
          <p style="margin: 24px 0 0; font-size: 12px; color: #6b7280;">Si no solicitaste este correo, podés ignorarlo.</p>
        </td>
      </tr>
    </table>
  </body>
</html>`;
}

export function passwordResetTemplate(link: string): MailTemplate {
  return {
    subject: 'Restablecé tu contraseña — Croply',
    html: wrap_html(
      'Restablecé tu contraseña',
      `<p>Recibimos una solicitud para restablecer tu contraseña.</p>
          <p>Hacé clic en el botón para elegir una nueva:</p>
          <p style="margin: 24px 0;">
            <a href="${link}" style="display: inline-block; background: #2f5d3a; color: #ffffff; text-decoration: none; padding: 12px 20px; border-radius: 8px;">
              Restablecer contraseña
            </a>
          </p>
          <p>O copiá este enlace en tu navegador:</p>
          <p style="word-break: break-all;">${link}</p>`,
    ),
  };
}

export function invitationTemplate(link: string): MailTemplate {
  return {
    subject: 'Te invitaron a unirte a una finca — Croply',
    html: wrap_html(
      'Invitación a Croply',
      `<p>Te invitaron a formar parte de un establecimiento en Croply.</p>
          <p>Completá tu registro con el siguiente enlace:</p>
          <p style="margin: 24px 0;">
            <a href="${link}" style="display: inline-block; background: #2f5d3a; color: #ffffff; text-decoration: none; padding: 12px 20px; border-radius: 8px;">
              Aceptar invitación
            </a>
          </p>
          <p>O copiá este enlace en tu navegador:</p>
          <p style="word-break: break-all;">${link}</p>`,
    ),
  };
}
