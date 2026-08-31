import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

@Injectable()
export class MailerStubService {
  private readonly logger = new Logger(MailerStubService.name);

  constructor(private readonly config: ConfigService) {}

  async send_password_reset(email: string, token: string): Promise<void> {
    const link = `${this.frontend_origin()}/resetear-contrasena?token=${token}`;
    this.logger.log(`[STUB MAIL] Reset password para ${email}: ${link}`);
  }

  async send_invitation(email: string, token: string): Promise<void> {
    const link = `${this.frontend_origin()}/registro-invitado/${token}`;
    this.logger.log(`[STUB MAIL] Invitación para ${email}: ${link}`);
  }

  private frontend_origin(): string {
    return (
      this.config.get<string>('FRONTEND_URL') ??
      this.config.get<string>('CORS_ORIGIN') ??
      'http://localhost:5173'
    );
  }
}
