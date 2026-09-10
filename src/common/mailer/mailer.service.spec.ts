import { Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { MailerService } from './mailer.service';
import { MailProvider } from './mail-provider.interface';

describe('MailerService', () => {
  let provider: { send: jest.Mock };
  let service: MailerService;

  beforeEach(() => {
    provider = { send: jest.fn().mockResolvedValue(undefined) };
    service = new MailerService(
      provider as unknown as MailProvider,
      {
        get: jest.fn().mockReturnValue('http://localhost:5173'),
      } as unknown as ConfigService,
    );
  });

  it('envía el mail de reset con el link correcto', async () => {
    await service.send_password_reset('user@croply.app', 'token-abc');

    expect(provider.send).toHaveBeenCalledWith(
      expect.objectContaining({
        to: 'user@croply.app',
        subject: 'Restablecé tu contraseña — Croply',
        html: expect.stringContaining(
          'http://localhost:5173/resetear-contrasena?token=token-abc',
        ),
      }),
    );
  });

  it('envía el mail de invitación con el link correcto', async () => {
    await service.send_invitation('invitado@finca.com', 'token-xyz');

    expect(provider.send).toHaveBeenCalledWith(
      expect.objectContaining({
        to: 'invitado@finca.com',
        subject: 'Te invitaron a unirte a una finca — Croply',
        html: expect.stringContaining(
          'http://localhost:5173/registro-invitado/token-xyz',
        ),
      }),
    );
  });

  it('loguea el error y no relanza si el provider falla', async () => {
    const error = jest.spyOn(Logger.prototype, 'error').mockImplementation();
    provider.send.mockRejectedValue(new Error('Resend down'));

    await expect(
      service.send_invitation('invitado@finca.com', 'token-xyz'),
    ).resolves.toBeUndefined();

    expect(error).toHaveBeenCalled();
    error.mockRestore();
  });
});
