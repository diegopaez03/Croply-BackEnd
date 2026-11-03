import { AlertaClimatica } from './entities/alerta-climatica.entity';
import { AlertasClimaticasCronService } from './alertas-climaticas-cron.service';
import { EstadoAlertaClimatica } from './enums/estado-alerta-climatica.enum';
import { TipoNotificacion } from './enums/tipo-notificacion.enum';

const PRONOSTICO = {
  temp_actual: 4,
  humedad_relativa: 40,
  temp_min_pronostico: -2,
  temp_max_pronostico: 12,
  precip_pronostico_24h: 0,
  viento_kmh: 10,
  wind_gust_kmh: 14,
  et0_diario: 3,
};

const HELADA = {
  codigo_alerta: 'ALERTA_HELADA',
  severidad: 'Alta',
  descripcion: 'Helada severa pronosticada.',
};

function finca(id_finca: number) {
  return { id_finca, fecha_baja_finca: null };
}

describe('AlertasClimaticasCronService', () => {
  let finca_repo: { find: jest.Mock; findOne: jest.Mock };
  let plan_repo: { find: jest.Mock };
  let usuario_finca_repo: { find: jest.Mock };
  let alerta_repo: { find: jest.Mock };
  let clima_service: { obtener_variables_pronostico: jest.Mock };
  let ai_service: { evaluate_climate: jest.Mock };
  let alerta_tx: { find: jest.Mock; create: jest.Mock; save: jest.Mock };
  let notificacion_tx: { create: jest.Mock; save: jest.Mock };
  let service: AlertasClimaticasCronService;

  beforeEach(() => {
    finca_repo = {
      find: jest.fn().mockResolvedValue([]),
      findOne: jest.fn(),
    };
    plan_repo = {
      find: jest.fn().mockResolvedValue([
        {
          fecha_inicio_pa: '2026-09-01',
          cultivo_base: { nombre_cultivo_base: 'Tomate' },
        },
      ]),
    };
    usuario_finca_repo = { find: jest.fn().mockResolvedValue([]) };
    alerta_repo = { find: jest.fn().mockResolvedValue([]) };
    clima_service = {
      obtener_variables_pronostico: jest.fn().mockResolvedValue(PRONOSTICO),
    };
    ai_service = {
      evaluate_climate: jest.fn().mockResolvedValue([HELADA]),
    };
    alerta_tx = {
      find: jest.fn().mockResolvedValue([]),
      create: jest.fn(<T>(data: T): T => data),
      save: jest.fn(<T extends { id_alerta?: number }>(entity: T) =>
        Promise.resolve({ ...entity, id_alerta: entity.id_alerta ?? 89 }),
      ),
    };
    notificacion_tx = {
      create: jest.fn(<T>(data: T): T => data),
      save: jest.fn(<T>(entity: T) => Promise.resolve(entity)),
    };
    const data_source = {
      transaction: jest.fn(
        (
          cb: (manager: {
            getRepository: (
              entity: unknown,
            ) => typeof alerta_tx | typeof notificacion_tx;
          }) => unknown,
        ) =>
          cb({
            getRepository: (entity: unknown) =>
              entity === AlertaClimatica ? alerta_tx : notificacion_tx,
          }),
      ),
    };

    service = new AlertasClimaticasCronService(
      finca_repo as never,
      plan_repo as never,
      usuario_finca_repo as never,
      alerta_repo as never,
      clima_service as never,
      ai_service as never,
      data_source as never,
    );
  });

  it('persiste una alerta vigente y una notificación por usuario activo', async () => {
    finca_repo.find.mockResolvedValue([finca(3)]);
    usuario_finca_repo.find.mockResolvedValue([
      { fecha_fin_rol: null, usuario: { id_usuario: 7 } },
      { fecha_fin_rol: null, usuario: { id_usuario: 7 } },
      {
        fecha_fin_rol: new Date(Date.now() - 60_000),
        usuario: { id_usuario: 9 },
      },
    ]);

    await service.ejecutar();

    expect(alerta_tx.save).toHaveBeenCalledWith(
      expect.objectContaining({
        codigo_alerta: 'ALERTA_HELADA',
        estado: EstadoAlertaClimatica.VIGENTE,
      }),
    );
    expect(notificacion_tx.save).toHaveBeenCalledTimes(1);
    expect(notificacion_tx.create).toHaveBeenCalledWith(
      expect.objectContaining({
        tipo: TipoNotificacion.ALERTA_CLIMATICA,
        titulo: 'Alerta de helada',
        mensaje: HELADA.descripcion,
        usuario: { id_usuario: 7 },
      }),
    );
  });

  it('no vuelve a notificar una alerta que sigue vigente', async () => {
    finca_repo.find.mockResolvedValue([finca(3)]);
    alerta_tx.find.mockResolvedValue([
      {
        codigo_alerta: 'ALERTA_HELADA',
        estado: EstadoAlertaClimatica.VIGENTE,
      },
    ]);

    await service.ejecutar();

    expect(notificacion_tx.save).not.toHaveBeenCalled();
    expect(alerta_tx.save).not.toHaveBeenCalled();
  });

  it('marca como resuelta una alerta vigente que el motor ya no devuelve', async () => {
    finca_repo.find.mockResolvedValue([finca(3)]);
    ai_service.evaluate_climate.mockResolvedValue([]);
    const vigente = {
      codigo_alerta: 'ALERTA_HELADA',
      estado: EstadoAlertaClimatica.VIGENTE,
      fecha_resolucion: null as Date | null,
    };
    alerta_tx.find.mockResolvedValue([vigente]);

    await service.ejecutar();

    expect(vigente.estado).toBe(EstadoAlertaClimatica.RESUELTA);
    expect(vigente.fecha_resolucion).toBeInstanceOf(Date);
    expect(alerta_tx.save).toHaveBeenCalledWith(vigente);
    expect(notificacion_tx.save).not.toHaveBeenCalled();
  });

  it('sigue con la finca siguiente si una evaluación falla', async () => {
    finca_repo.find.mockResolvedValue([finca(3), finca(4)]);
    clima_service.obtener_variables_pronostico
      .mockRejectedValueOnce(new Error('meteo'))
      .mockResolvedValueOnce(PRONOSTICO);

    await service.ejecutar();

    expect(ai_service.evaluate_climate).toHaveBeenCalledTimes(1);
    expect(alerta_tx.save).toHaveBeenCalled();
  });

  it('lista las alertas vigentes de una finca activa', async () => {
    finca_repo.findOne.mockResolvedValue(finca(3));
    alerta_repo.find.mockResolvedValue([
      {
        id_alerta: 89,
        codigo_alerta: 'ALERTA_HELADA',
        severidad: 'Alta',
        fecha_deteccion: new Date('2026-10-23T05:00:00Z'),
        descripcion: HELADA.descripcion,
        estado: EstadoAlertaClimatica.VIGENTE,
      },
    ]);

    const result = await service.listar(3);

    expect(result.alertas).toEqual([
      {
        id_alerta: 89,
        codigo_alerta: 'ALERTA_HELADA',
        severidad: 'Alta',
        fecha_deteccion: '2026-10-23T05:00:00.000Z',
        descripcion: HELADA.descripcion,
        estado: EstadoAlertaClimatica.VIGENTE,
      },
    ]);
  });
});
