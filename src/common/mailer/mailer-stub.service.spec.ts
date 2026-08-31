import { Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { MailerStubService } from './mailer-stub.service';

describe('MailerStubService', () => {
  it('arma el link de invitación hacia /registro-invitado/:token', async () => {
    const log = jest.spyOn(Logger.prototype, 'log').mockImplementation();
    const service = new MailerStubService({
      get: jest.fn().mockReturnValue('http://localhost:5173'),
    } as unknown as ConfigService);

    await service.send_invitation('invitado@finca.com', 'token-abc');

    expect(log).toHaveBeenCalledWith(
      '[STUB MAIL] Invitación para invitado@finca.com: http://localhost:5173/registro-invitado/token-abc',
    );
    log.mockRestore();
  });
});
