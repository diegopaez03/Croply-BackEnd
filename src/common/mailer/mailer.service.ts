import { Inject, Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import {
  EmailMessage,
  MAIL_PROVIDER,
  MailProvider,
} from './mail-provider.interface';
import {
  invitationTemplate,
  passwordResetTemplate,
} from './templates/mail-templates';

@Injectable()
export class MailerService {
  private readonly logger = new Logger(MailerService.name);

  constructor(
    @Inject(MAIL_PROVIDER) private readonly provider: MailProvider,
    private readonly config: ConfigService,
  ) {}

  async send_password_reset(email: string, token: string): Promise<void> {
    const link = `${this.frontend_origin()}/resetear-contrasena?token=${token}`;
    const template = passwordResetTemplate(link);
    await this.safe_send({
      to: email,
      subject: template.subject,
      html: template.html,
    });
  }

  async send_invitation(email: string, token: string): Promise<void> {
    const link = `${this.frontend_origin()}/registro-invitado/${token}`;
    const template = invitationTemplate(link);
    await this.safe_send({
      to: email,
      subject: template.subject,
      html: template.html,
    });
  }

  private async safe_send(message: EmailMessage): Promise<void> {
    try {
      await this.provider.send(message);
    } catch (error) {
      this.logger.error(
        `Error al enviar mail a ${message.to}: ${
          error instanceof Error ? error.message : String(error)
        }`,
      );
    }
  }

  private frontend_origin(): string {
    return (
      this.config.get<string>('FRONTEND_URL') ??
      this.config.get<string>('CORS_ORIGIN') ??
      'http://localhost:5173'
    );
  }
}
