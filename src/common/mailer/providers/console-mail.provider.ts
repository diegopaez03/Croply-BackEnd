import { Logger } from '@nestjs/common';
import { EmailMessage, MailProvider } from '../mail-provider.interface';

export class ConsoleMailProvider implements MailProvider {
  private readonly logger = new Logger(ConsoleMailProvider.name);

  async send(message: EmailMessage): Promise<void> {
    this.logger.log(
      `[DEV MAIL] to=${message.to} subject="${message.subject}"\n${message.html}`,
    );
  }
}
