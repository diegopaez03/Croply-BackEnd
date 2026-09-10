import { Logger } from '@nestjs/common';
import { ConsoleMailProvider } from './console-mail.provider';

describe('ConsoleMailProvider', () => {
  it('loguea destinatario, asunto y cuerpo', async () => {
    const log = jest.spyOn(Logger.prototype, 'log').mockImplementation();
    const provider = new ConsoleMailProvider();

    await provider.send({
      to: 'invitado@finca.com',
      subject: 'Invitación',
      html: '<p>Hola</p>',
    });

    expect(log).toHaveBeenCalledWith(
      '[DEV MAIL] to=invitado@finca.com subject="Invitación"\n<p>Hola</p>',
    );
    log.mockRestore();
  });
});
