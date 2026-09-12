import { Module } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { MAIL_PROVIDER } from './mail-provider.interface';
import { create_mail_provider } from './mail-provider.factory';
import { MailerService } from './mailer.service';

@Module({
  providers: [
    {
      provide: MAIL_PROVIDER,
      inject: [ConfigService],
      useFactory: (config: ConfigService) =>
        create_mail_provider(
          config.get<string>('NODE_ENV', 'development'),
          config,
        ),
    },
    MailerService,
  ],
  exports: [MailerService],
})
export class MailerModule {}
