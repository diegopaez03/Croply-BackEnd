import { HttpStatus } from '@nestjs/common';
import { EstadoParcela, EstadoTransmision } from '../../common/enums';
import { ParcelasService } from './parcelas.service';

function repository<T extends Record<string, jest.Mock>>(extra: T = {} as T) {
  return {
    findOne: jest.fn(),
    find: jest.fn(),
    create: jest.fn((value) => value),
    save: jest.fn(async (value) => ({ ...value, id_parcela: value.id_parcela ?? 101 })),
    ...extra,
  } as T;
}

describe('ParcelasService', () => {
  let service: ParcelasService;
  let parcela_repo: ReturnType<typeof repository>;
  let controlador_repo: ReturnType<typeof repository>;
  let sensor_repo: ReturnType<typeof repository>;
  let finca_repo: ReturnType<typeof repository>;
  let codigo_qr_repo: ReturnType<typeof repository>;
  let tipos_sensor_service: { find_activo_by_id: jest.Mock };
  let simulador_sincronizacion_service: {
    sincronizar_creacion: jest.Mock;
    sincronizar_actualizacion: jest.Mock;
    sincronizar_baja: jest.Mock;
  };

  beforeEach(() => {
    parcela_repo = repository();
    controlador_repo = repository();
    sensor_repo = repository();
    finca_repo = repository();
    codigo_qr_repo = repository();
    tipos_sensor_service = { find_activo_by_id: jest.fn() };
    simulador_sincronizacion_service = {
      sincronizar_creacion: jest.fn().mockResolvedValue(undefined),
      sincronizar_actualizacion: jest.fn().mockResolvedValue(undefined),
      sincronizar_baja: jest.fn().mockResolvedValue(undefined),
    };
    controlador_repo.find.mockResolvedValue([]);
    service = new ParcelasService(
      parcela_repo as never,
      controlador_repo as never,
      sensor_repo as never,
      finca_repo as never,
      codigo_qr_repo as never,
      tipos_sensor_service as never,
      simulador_sincronizacion_service as never,
    );
  });

  it('crea parcela y sensor con Sin_senal', async () => {
    const finca = { id_finca: 12, fecha_baja_finca: null };
    const tipo_sensor = {
      id_tipo_sensor: 15,
      codigo_tipo_sensor: 'PH',
      nombre_tipo_sensor: 'Sensor de pH',
    };
    finca_repo.findOne.mockResolvedValue(finca);
    parcela_repo.findOne
      .mockResolvedValueOnce(null)
      .mockResolvedValueOnce({
        id_parcela: 101,
        finca,
        nombre_parcela: 'Lote Norte',
        superficie_parcela: 12.5,
        estado_parcela: EstadoParcela.ACTIVA,
        controladores: [],
      });
    tipos_sensor_service.find_activo_by_id.mockResolvedValue(tipo_sensor);
    controlador_repo.save.mockImplementation(async (value) => ({
      ...value,
      id_controlador_sensor: 7,
      sensores: [],
    }));

    const result = await service.crear(12, {
      nombre_parcela: 'Lote Norte',
      superficie_parcela: 12.5,
      controladores: [
        {
          nombre_controlador: 'Controlador Norte',
          ip_controlador: '192.168.1.10',
          sensores: [{ id_tipo_sensor: 15, ip_sensor: '192.168.1.11' }],
        },
      ],
    });

    expect(result.message).toBe('Parcela creada correctamente');
    expect(sensor_repo.create).toHaveBeenCalledWith(
      expect.objectContaining({
        estado_senal: EstadoTransmision.SIN_SENAL,
        ultimo_valor: null,
        fecha_ultima_lectura: null,
      }),
    );
  });

  it('rechaza nombre de parcela duplicado dentro de la finca', async () => {
    finca_repo.findOne.mockResolvedValue({ id_finca: 12, fecha_baja_finca: null });
    parcela_repo.findOne.mockResolvedValue({ id_parcela: 99 });

    await expect(
      service.crear(12, {
        nombre_parcela: 'Lote Norte',
        superficie_parcela: 12.5,
      }),
    ).rejects.toMatchObject({
      errorCode: 'DUPLICATE_VALUE',
      field: 'nombre_parcela',
      status: HttpStatus.CONFLICT,
    });
  });

  it('da de baja parcela, controladores y sensores', async () => {
    const sensor = { id_sensor: 501, fecha_baja: null };
    const controlador = {
      id_controlador_sensor: 7,
      fecha_baja: null,
      sensores: [sensor],
    };
    const parcela = {
      id_parcela: 101,
      finca: { id_finca: 12 },
      estado_parcela: EstadoParcela.ACTIVA,
      fecha_baja_parcela: null,
    };
    parcela_repo.findOne.mockResolvedValue(parcela);
    controlador_repo.find.mockResolvedValue([controlador]);

    const result = await service.dar_baja(12, 101);

    expect(parcela.estado_parcela).toBe(EstadoParcela.INACTIVA);
    expect(controlador.fecha_baja).toEqual(expect.any(Date));
    expect(sensor.fecha_baja).toEqual(expect.any(Date));
    expect(result.message).toContain('Parcela dada de baja correctamente');
  });

  it('genera el QR una sola vez y devuelve el existente en un segundo intento', async () => {
    parcela_repo.findOne.mockResolvedValue({
      id_parcela: 101,
      estado_parcela: EstadoParcela.ACTIVA,
      finca: { id_finca: 12, fecha_baja_finca: null },
    });
    codigo_qr_repo.findOne
      .mockResolvedValueOnce(null)
      .mockResolvedValueOnce({
        url_acceso_qr: 'https://app.croply.com/parcelas/101?qr=abc',
        fecha_generacion_qr: new Date('2026-08-27T00:00:00Z'),
      });
    codigo_qr_repo.save.mockResolvedValue({
      url_acceso_qr: 'https://app.croply.com/parcelas/101?qr=abc',
      fecha_generacion_qr: new Date('2026-08-27T00:00:00Z'),
    });

    const first = await service.generar_codigo_qr(101);
    const second = await service.generar_codigo_qr(101);

    expect(first).toMatchObject({
      message: 'Código QR generado correctamente',
    });
    expect(first.url_acceso_qr).toContain('/parcelas/101?qr=');
    expect(second).toEqual({
      url_acceso_qr: 'https://app.croply.com/parcelas/101?qr=abc',
      fecha_generacion_qr: '2026-08-27',
    });
    expect(codigo_qr_repo.save).toHaveBeenCalledTimes(1);
  });

  it('devuelve RESOURCE_NOT_FOUND si el QR todavía no existe', async () => {
    parcela_repo.findOne.mockResolvedValue({
      id_parcela: 101,
      estado_parcela: EstadoParcela.ACTIVA,
      finca: { id_finca: 12, fecha_baja_finca: null },
    });
    codigo_qr_repo.findOne.mockResolvedValue(null);

    await expect(service.consultar_codigo_qr(101)).rejects.toMatchObject({
      errorCode: 'RESOURCE_NOT_FOUND',
      status: HttpStatus.NOT_FOUND,
    });
  });
});
