import { HttpStatus } from '@nestjs/common';
import { TipoNotificacion } from '../alertas-climaticas/enums/tipo-notificacion.enum';
import { NotificacionesService } from './notificaciones.service';

function cadena(getMany: jest.Mock) {
  const qb = {
    innerJoinAndSelect: jest.fn(),
    innerJoin: jest.fn(),
    where: jest.fn(),
    andWhere: jest.fn(),
    getMany,
  };
  qb.innerJoinAndSelect.mockReturnValue(qb);
  qb.innerJoin.mockReturnValue(qb);
  qb.where.mockReturnValue(qb);
  qb.andWhere.mockReturnValue(qb);
  return qb;
}

function usuario() {
  return {
    id_usuario: 7,
    usuario_fincas: [
      {
        fecha_fin_rol: null,
        finca: { id_finca: 12, fecha_baja_finca: null },
        rol_finca: { codigo_rol_finca: 'ADMIN_FINCA', rol_permisos: [] },
      },
    ],
  };
}

describe('NotificacionesService', () => {
  const hoy = new Date().toISOString().slice(0, 10);
  let notificacion_repo: {
    find: jest.Mock;
    findOne: jest.Mock;
    save: jest.Mock;
    create: jest.Mock;
    createQueryBuilder: jest.Mock;
  };
  let tarea_repo: { createQueryBuilder: jest.Mock };
  let tareas_get_many: jest.Mock;
  let existentes_get_many: jest.Mock;
  let service: NotificacionesService;

  beforeEach(() => {
    tareas_get_many = jest.fn().mockResolvedValue([]);
    existentes_get_many = jest.fn().mockResolvedValue([]);
    notificacion_repo = {
      find: jest.fn().mockResolvedValue([]),
      findOne: jest.fn(),
      save: jest.fn((entidad) => Promise.resolve(entidad)),
      create: jest.fn((data) => data),
      createQueryBuilder: jest.fn(() => cadena(existentes_get_many)),
    };
    tarea_repo = {
      createQueryBuilder: jest.fn(() => cadena(tareas_get_many)),
    };
    service = new NotificacionesService(
      notificacion_repo as never,
      tarea_repo as never,
    );
  });

  function tarea(overrides: Record<string, unknown> = {}) {
    return {
      id_tarea: 5,
      nombre_tarea: 'Riego de la mañana',
      fecha_planificada_tarea: hoy,
      estado_tarea: { es_estado_finalizador: false },
      hito: {
        plan_accion: {
          parcela: {
            id_parcela: 15,
            nombre_parcela: 'Lote Norte',
            finca: { id_finca: 12 },
          },
        },
      },
      ...overrides,
    };
  }

  it('materializa la tarea de hoy y omite la finalizada o la de otro día', async () => {
    tareas_get_many.mockResolvedValue([
      tarea(),
      tarea({
        id_tarea: 6,
        estado_tarea: { es_estado_finalizador: true },
      }),
      tarea({ id_tarea: 7, fecha_planificada_tarea: '2000-01-01' }),
    ]);
    notificacion_repo.find.mockResolvedValue([
      {
        id_notificacion: 1,
        tipo: TipoNotificacion.ALERTA_CLIMATICA,
        titulo: 'Alerta de helada',
        mensaje: 'Mínima bajo cero.',
        leida: false,
        fecha_creacion: new Date('2026-11-02T10:00:00Z'),
        fecha_lectura: null,
        alerta: { finca: { id_finca: 12 } },
        tarea: null,
      },
      {
        id_notificacion: 2,
        tipo: TipoNotificacion.TAREA_PENDIENTE,
        titulo: 'Riego de la mañana',
        mensaje: 'Lote Norte',
        leida: false,
        fecha_creacion: new Date(),
        fecha_lectura: null,
        alerta: null,
        tarea: tarea(),
      },
    ]);

    const result = await service.listar(usuario() as never);

    expect(notificacion_repo.create).toHaveBeenCalledTimes(1);
    expect(notificacion_repo.create).toHaveBeenCalledWith(
      expect.objectContaining({
        tipo: TipoNotificacion.TAREA_PENDIENTE,
        titulo: 'Riego de la mañana',
        mensaje: 'Lote Norte',
        leida: false,
      }),
    );
    expect(result.no_leidas).toBe(2);
    expect(result.notificaciones[0].id_finca).toBe(12);
    expect(result.notificaciones[0].id_parcela).toBeNull();
  });

  it('no duplica una tarea ya notificada en el día', async () => {
    tareas_get_many.mockResolvedValue([tarea()]);
    existentes_get_many.mockResolvedValue([{ tarea: { id_tarea: 5 } }]);
    notificacion_repo.find.mockResolvedValue([]);

    await service.listar(usuario() as never);

    expect(notificacion_repo.save).not.toHaveBeenCalled();
  });

  it('marca una notificación como leída y persiste la fecha de lectura', async () => {
    const previa = {
      id_notificacion: 9,
      tipo: TipoNotificacion.ALERTA_CLIMATICA,
      titulo: 'Alerta de helada',
      mensaje: 'Mínima bajo cero.',
      leida: false,
      fecha_creacion: new Date('2026-11-02T10:00:00Z'),
      fecha_lectura: null,
      alerta: { finca: { id_finca: 12 } },
      tarea: null,
    };
    notificacion_repo.findOne.mockResolvedValue(previa);
    const antes = Date.now();

    const result = await service.marcar_leida(usuario() as never, 9);

    expect(result.leida).toBe(true);
    expect(result.fecha_lectura).not.toBeNull();
    expect(new Date(result.fecha_lectura as string).getTime()).toBeGreaterThanOrEqual(
      antes - 1000,
    );
    expect(notificacion_repo.save).toHaveBeenCalledWith(
      expect.objectContaining({ leida: true }),
    );
  });

  it('no cambia la fecha de lectura si ya estaba leída', async () => {
    const fecha = new Date('2026-11-02T11:00:00Z');
    notificacion_repo.findOne.mockResolvedValue({
      id_notificacion: 9,
      tipo: TipoNotificacion.ALERTA_CLIMATICA,
      titulo: 'Alerta de helada',
      mensaje: 'Mínima bajo cero.',
      leida: true,
      fecha_creacion: new Date('2026-11-02T10:00:00Z'),
      fecha_lectura: fecha,
      alerta: { finca: { id_finca: 12 } },
      tarea: null,
    });

    const result = await service.marcar_leida(usuario() as never, 9);

    expect(notificacion_repo.save).not.toHaveBeenCalled();
    expect(result.fecha_lectura).toBe(fecha.toISOString());
  });

  it('marca todas las no leídas con la misma fecha de lectura', async () => {
    const pendientes = [
      { id_notificacion: 1, leida: false, fecha_lectura: null },
      { id_notificacion: 2, leida: false, fecha_lectura: null },
    ];
    notificacion_repo.find.mockResolvedValue(pendientes);

    const result = await service.marcar_todas_leidas(usuario() as never);

    expect(result).toEqual({ no_leidas: 0 });
    expect(notificacion_repo.save).toHaveBeenCalledWith(
      expect.arrayContaining([
        expect.objectContaining({
          id_notificacion: 1,
          leida: true,
          fecha_lectura: expect.any(Date),
        }),
        expect.objectContaining({
          id_notificacion: 2,
          leida: true,
          fecha_lectura: expect.any(Date),
        }),
      ]),
    );
    const guardadas = notificacion_repo.save.mock.calls[0][0] as Array<{
      fecha_lectura: Date;
    }>;
    expect(guardadas[0].fecha_lectura.getTime()).toBe(
      guardadas[1].fecha_lectura.getTime(),
    );
  });

  it('rechaza marcar una notificación de otro usuario', async () => {
    notificacion_repo.findOne.mockResolvedValue(null);

    await expect(service.marcar_leida(usuario() as never, 99)).rejects.toMatchObject(
      {
        errorCode: 'RESOURCE_NOT_FOUND',
        status: HttpStatus.NOT_FOUND,
      },
    );
  });
});
