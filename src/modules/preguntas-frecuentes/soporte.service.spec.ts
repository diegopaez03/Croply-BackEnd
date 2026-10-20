import { Logger } from '@nestjs/common';
import { SoporteService } from './soporte.service';

describe('SoporteService', () => {
  let warn: jest.SpyInstance;

  const crear = (env: Record<string, string | undefined>) =>
    new SoporteService({
      get: jest.fn((key: string) => env[key]),
    } as never);

  beforeEach(() => {
    warn = jest.spyOn(Logger.prototype, 'warn').mockImplementation(() => {});
  });

  afterEach(() => {
    warn.mockRestore();
  });

  it('devuelve ambos valores cuando son válidos', () => {
    const service = crear({
      MANUAL_USUARIO_URL: 'https://ejemplo.com/manual-croply',
      SOPORTE_EMAIL: 'croplyagronomia@gmail.com',
    });

    expect(service.obtener_configuracion()).toEqual({
      manual_usuario_url: 'https://ejemplo.com/manual-croply',
      email_soporte: 'croplyagronomia@gmail.com',
    });
    expect(warn).not.toHaveBeenCalled();
  });

  it('acepta una URL http://', () => {
    const service = crear({ MANUAL_USUARIO_URL: 'http://intranet/manual' });

    expect(service.obtener_configuracion().manual_usuario_url).toBe(
      'http://intranet/manual',
    );
  });

  it('devuelve null sin warn cuando ambas variables están vacías o ausentes', () => {
    expect(
      crear({ MANUAL_USUARIO_URL: '', SOPORTE_EMAIL: '' }).obtener_configuracion(),
    ).toEqual({ manual_usuario_url: null, email_soporte: null });
    expect(crear({}).obtener_configuracion()).toEqual({
      manual_usuario_url: null,
      email_soporte: null,
    });
    expect(warn).not.toHaveBeenCalled();
  });

  it('trata un valor de solo espacios como null', () => {
    const service = crear({ MANUAL_USUARIO_URL: '   ', SOPORTE_EMAIL: '  \t ' });

    expect(service.obtener_configuracion()).toEqual({
      manual_usuario_url: null,
      email_soporte: null,
    });
    expect(warn).not.toHaveBeenCalled();
  });

  it('recorta los espacios de los extremos de un valor válido', () => {
    const service = crear({
      MANUAL_USUARIO_URL: '  https://ejemplo.com/manual  ',
      SOPORTE_EMAIL: ' soporte@ejemplo.com ',
    });

    expect(service.obtener_configuracion()).toEqual({
      manual_usuario_url: 'https://ejemplo.com/manual',
      email_soporte: 'soporte@ejemplo.com',
    });
  });

  it('descarta una URL javascript: con warn', () => {
    const service = crear({
      MANUAL_USUARIO_URL: 'javascript:alert(1)',
      SOPORTE_EMAIL: 'soporte@ejemplo.com',
    });

    expect(service.obtener_configuracion()).toEqual({
      manual_usuario_url: null,
      email_soporte: 'soporte@ejemplo.com',
    });
    expect(warn).toHaveBeenCalledTimes(1);
    expect(warn).toHaveBeenCalledWith(
      expect.stringContaining('MANUAL_USUARIO_URL'),
    );
  });

  it('descarta una URL sin protocolo con warn', () => {
    const service = crear({ MANUAL_USUARIO_URL: 'www.ejemplo.com/manual' });

    expect(service.obtener_configuracion().manual_usuario_url).toBeNull();
    expect(warn).toHaveBeenCalledTimes(1);
  });

  it.each(['soporte', 'soporte@', 'soporte@ejemplo', 'so porte@ejemplo.com'])(
    'descarta el email inválido "%s" con warn',
    (email) => {
      const service = crear({ SOPORTE_EMAIL: email });

      expect(service.obtener_configuracion().email_soporte).toBeNull();
      expect(warn).toHaveBeenCalledTimes(1);
      expect(warn).toHaveBeenCalledWith(
        expect.stringContaining('SOPORTE_EMAIL'),
      );
    },
  );
});
