import { ConfigService } from '@nestjs/config';
import { create_mail_provider } from './mail-provider.factory';
import { ConsoleMailProvider } from './providers/console-mail.provider';
import { ResendMailProvider } from './providers/resend-mail.provider';

describe('create_mail_provider', () => {
  it('usa ConsoleMailProvider fuera de production', () => {
    const config = {
      get: jest.fn(),
      getOrThrow: jest.fn(),
    } as unknown as ConfigService;

    const provider = create_mail_provider('development', config);

    expect(provider).toBeInstanceOf(ConsoleMailProvider);
  });

  it('usa ResendMailProvider en production', () => {
    const config = {
      get: jest.fn().mockReturnValue('Croply <no-reply@croply.app>'),
      getOrThrow: jest.fn().mockReturnValue('re_test_key'),
    } as unknown as ConfigService;

    const provider = create_mail_provider('production', config);

    expect(provider).toBeInstanceOf(ResendMailProvider);
    expect(config.getOrThrow).toHaveBeenCalledWith('RESEND_API_KEY');
  });
});
