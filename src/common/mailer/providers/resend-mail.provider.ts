import { Resend } from 'resend';
import { EmailMessage, MailProvider } from '../mail-provider.interface';

export class ResendMailProvider implements MailProvider {
  private readonly resend: Resend;
  private readonly from: string;

  constructor(apiKey: string, from: string) {
    this.resend = new Resend(apiKey);
    this.from = from;
  }

  async send(message: EmailMessage): Promise<void> {
    const { error } = await this.resend.emails.send({
      from: this.from,
      to: message.to,
      subject: message.subject,
      html: message.html,
    });

    if (error) {
      throw new Error(error.message);
    }
  }
}
