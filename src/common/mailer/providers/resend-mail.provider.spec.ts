const send = jest.fn();

jest.mock('resend', () => ({
  Resend: jest.fn().mockImplementation(() => ({
    emails: { send },
  })),
}));

import { ResendMailProvider } from './resend-mail.provider';

describe('ResendMailProvider', () => {
  beforeEach(() => {
    send.mockReset();
  });

  it('envía el mail con from, to, subject y html', async () => {
    send.mockResolvedValue({ data: { id: 're_1' }, error: null });
    const provider = new ResendMailProvider(
      're_test_key',
      'Croply <no-reply@croply.app>',
    );

    await provider.send({
      to: 'user@croply.app',
      subject: 'Hola',
      html: '<p>Cuerpo</p>',
    });

    expect(send).toHaveBeenCalledWith({
      from: 'Croply <no-reply@croply.app>',
      to: 'user@croply.app',
      subject: 'Hola',
      html: '<p>Cuerpo</p>',
    });
  });

  it('lanza si Resend responde con error', async () => {
    send.mockResolvedValue({
      data: null,
      error: { message: 'invalid api key' },
    });
    const provider = new ResendMailProvider(
      're_test_key',
      'Croply <no-reply@croply.app>',
    );

    await expect(
      provider.send({
        to: 'user@croply.app',
        subject: 'Hola',
        html: '<p>Cuerpo</p>',
      }),
    ).rejects.toThrow('invalid api key');
  });
});
