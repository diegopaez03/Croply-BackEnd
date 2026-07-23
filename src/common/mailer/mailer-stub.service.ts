import { Injectable, Logger } from '@nestjs/common';

@Injectable()
export class MailerStubService {
  private readonly logger = new Logger(MailerStubService.name);

  async send_password_reset(email: string, token: string): Promise<void> {
    const link = `http://localhost:5173/resetear-contrasena?token=${token}`;
    this.logger.log(`[STUB MAIL] Reset password para ${email}: ${link}`);
  }

  async send_invitation(email: string, token: string): Promise<void> {
    const link = `http://localhost:5173/invitacion/${token}`;
    this.logger.log(`[STUB MAIL] Invitación para ${email}: ${link}`);
  }
}
