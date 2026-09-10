import { ConfigService } from '@nestjs/config';
import { MailProvider } from './mail-provider.interface';
import { ConsoleMailProvider } from './providers/console-mail.provider';
import { ResendMailProvider } from './providers/resend-mail.provider';

export function create_mail_provider(
  nodeEnv: string,
  config: ConfigService,
): MailProvider {
  if (nodeEnv === 'production') {
    return new ResendMailProvider(
      config.getOrThrow<string>('RESEND_API_KEY'),
      config.get<string>('MAIL_FROM', 'Croply <no-reply@croply.app>'),
    );
  }

  return new ConsoleMailProvider();
}
