import { HttpStatus } from '@nestjs/common';
import { EstadoParcela, EstadoTransmision } from '../../common/enums';
import { SimuladorLecturaService } from './simulador-lectura.service';

function sensor(overrides: Record<string, unknown> = {}) {
  return {
    id_sensor: 17,
    fecha_baja: null,
    ultimo_valor: 10,
    fecha_ultima_lectura: new Date('2026-09-10T10:00:00.000Z'),
    estado_senal: EstadoTransmision.SIN_SENAL,
    tipo_sensor: {
      nombre_tipo_sensor: 'Sensor de pH',
      unidad_medida_ts: 'pH',
    },
    ...overrides,
  };
}

function parcela(sensores = [sensor()]) {
  return {
    id_parcela: 3,
    estado_parcela: EstadoParcela.ACTIVA,
    fecha_baja_parcela: null,
    finca: { fecha_baja_finca: null },
    controladores: [
      { fecha_baja: null, sensores },
    ],
  } as never;
}

describe('SimuladorLecturaService', () => {
  let service: SimuladorLecturaService;
  let parcela_repo: { find: jest.Mock; findOne: jest.Mock };
  let sensor_repo: { save: jest.Mock };
  let lectura_repo: { create: jest.Mock; save: jest.Mock };
  let axiosRef: { get: jest.Mock };
  let config: { get: jest.Mock };
  let scheduler: { addCronJob: jest.Mock };

  afterEach(() => {
    const job = scheduler.addCronJob.mock.calls[0]?.[1] as
      | { stop?: () => void }
      | undefined;
    job?.stop?.();
  });

  beforeEach(() => {
    parcela_repo = {
      find: jest.fn(),
      findOne: jest.fn(),
    };
    sensor_repo = { save: jest.fn(async (value) => value) };
    lectura_repo = {
      create: jest.fn((value) => value),
      save: jest.fn(async (value) => value),
    };
    axiosRef = { get: jest.fn() };
    config = {
      get: jest.fn((name: string, fallback: string) => {
        if (name === 'SIMULADOR_BASE_URL') return 'http://simulador.test';
        return fallback;
      }),
    };
    scheduler = { addCronJob: jest.fn() };
    service = new SimuladorLecturaService(
      parcela_repo as never,
      sensor_repo as never,
      lectura_repo as never,
      { axiosRef } as never,
      config as never,
      scheduler as never,
    );
  });

  it('inserta el valor viejo antes de actualizar el sensor', async () => {
    const lectura = {
      valor_actual: 12,
      fecha_ultima_lectura: new Date().toISOString(),
      sensor_id: 17,
    };
    const entidad = sensor();
    parcela_repo.find.mockResolvedValue([parcela([entidad])]);
    axiosRef.get.mockResolvedValue({
      data: { controladores: [{ controlador_id: 8, sensores: [lectura] }] },
    });

    await service.sincronizar_lecturas();

    expect(lectura_repo.create).toHaveBeenCalledWith(
      expect.objectContaining({
        valor_lectura_sensor: 10,
        sensor: entidad,
      }),
    );
    expect(lectura_repo.save.mock.invocationCallOrder[0]).toBeLessThan(
      sensor_repo.save.mock.invocationCallOrder[0],
    );
    expect(entidad.ultimo_valor).toBe(12);
    expect(entidad.estado_senal).toBe(EstadoTransmision.TRANSMITIENDO);
  });

  it('marca todos los sensores Sin_senal y conserva valores ante falla', async () => {
    const entidad = sensor({ ultimo_valor: 22 });
    parcela_repo.find.mockResolvedValue([parcela([entidad])]);
    axiosRef.get.mockRejectedValue(new Error('timeout'));

    await service.sincronizar_lecturas();

    expect(entidad.ultimo_valor).toBe(22);
    expect(entidad.estado_senal).toBe(EstadoTransmision.SIN_SENAL);
    expect(sensor_repo.save).toHaveBeenCalledWith(entidad);
  });

  it('marca Sin_senal cuando la respuesta trae una lectura nula', async () => {
    const entidad = sensor({ ultimo_valor: 30 });
    parcela_repo.find.mockResolvedValue([parcela([entidad])]);
    axiosRef.get.mockResolvedValue({
      data: {
        controladores: [
          {
            controlador_id: 8,
            sensores: [{ sensor_id: 17, valor_actual: null, fecha_ultima_lectura: null }],
          },
        ],
      },
    });

    await service.sincronizar_lecturas();

    expect(entidad.ultimo_valor).toBe(30);
    expect(entidad.estado_senal).toBe(EstadoTransmision.SIN_SENAL);
  });

  it('marca Sin_senal si la lectura supera la ventana de tolerancia', async () => {
    const entidad = sensor();
    parcela_repo.find.mockResolvedValue([parcela([entidad])]);
    axiosRef.get.mockResolvedValue({
      data: {
        controladores: [
          {
            controlador_id: 8,
            sensores: [
              {
                sensor_id: 17,
                valor_actual: 14,
                fecha_ultima_lectura: '2020-01-01T00:00:00.000Z',
              },
            ],
          },
        ],
      },
    });

    await service.sincronizar_lecturas();

    expect(entidad.ultimo_valor).toBe(14);
    expect(entidad.estado_senal).toBe(EstadoTransmision.SIN_SENAL);
  });

  it('devuelve el shape de monitoreo y null general sin sensores', async () => {
    const entidad = sensor({ id_sensor: 17 });
    parcela_repo.findOne.mockResolvedValueOnce(parcela([entidad]));
    await expect(service.obtener_monitoreo(3)).resolves.toEqual({
      estado_general: EstadoTransmision.SIN_SENAL,
      sensores: [
        {
          id_sensor: 17,
          nombre_tipo_sensor: 'Sensor de pH',
          unidad_medida_ts: 'pH',
          ultimo_valor: 10,
          fecha_ultima_lectura: entidad.fecha_ultima_lectura,
          estado_senal: EstadoTransmision.SIN_SENAL,
        },
      ],
    });

    parcela_repo.findOne.mockResolvedValueOnce(parcela([]));
    await expect(service.obtener_monitoreo(3)).resolves.toEqual({
      estado_general: null,
      sensores: [],
    });
  });

  it('devuelve 404 si la parcela no existe o está inactiva', async () => {
    parcela_repo.findOne.mockResolvedValue(null);

    await expect(service.obtener_monitoreo(999)).rejects.toMatchObject({
      errorCode: 'RESOURCE_NOT_FOUND',
      status: HttpStatus.NOT_FOUND,
    });
  });

  it('registra el cron con el intervalo configurable', () => {
    service.onModuleInit();

    expect(scheduler.addCronJob).toHaveBeenCalledWith(
      'simulador-lecturas',
      expect.any(Object),
    );
  });
});
