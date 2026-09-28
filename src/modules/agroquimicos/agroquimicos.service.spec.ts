import { EstadoPlanAccion, TipoOperacion } from '../../common/enums';
import { AgroquimicosService } from './agroquimicos.service';

const ACTOR = { id_usuario: 7 } as never;

function repo() {
  return {
    findOne: jest.fn(),
    find: jest.fn().mockResolvedValue([]),
    create: jest.fn(<T>(value: T): T => value),
    save: jest.fn(<T>(value: T) => Promise.resolve(value)),
    createQueryBuilder: jest.fn(),
  };
}

function query_builder(rows: unknown[] = [], total = rows.length) {
  return {
    innerJoinAndSelect: jest.fn().mockReturnThis(),
    innerJoin: jest.fn().mockReturnThis(),
    leftJoinAndSelect: jest.fn().mockReturnThis(),
    where: jest.fn().mockReturnThis(),
    andWhere: jest.fn().mockReturnThis(),
    orderBy: jest.fn().mockReturnThis(),
    addOrderBy: jest.fn().mockReturnThis(),
    skip: jest.fn().mockReturnThis(),
    take: jest.fn().mockReturnThis(),
    getManyAndCount: jest.fn().mockResolvedValue([rows, total]),
    getMany: jest.fn().mockResolvedValue(rows),
  };
}

describe('AgroquimicosService', () => {
  let service: AgroquimicosService;
  let agro_repo: ReturnType<typeof repo>;
  let parcela_repo: ReturnType<typeof repo>;
  let plan_repo: ReturnType<typeof repo>;
  let hito_repo: ReturnType<typeof repo>;
  let usuario_finca_repo: ReturnType<typeof repo>;
  let finca_repo: ReturnType<typeof repo>;
  let planes_service: { crear_tarea_ya_finalizada: jest.Mock };
  let tipos_tarea_service: { tipo_agroquimico_activo: jest.Mock };
  let log_service: { registrar: jest.Mock };
  let data_source: { transaction: jest.Mock };

  const parcela = {
    id_parcela: 101,
    nombre_parcela: 'Parcela Norte',
    finca: { id_finca: 12 },
  };
  const hito = { id_hito: 201, nombre_hito: 'Siembra' };
  const responsable = {
    id_usuario_finca: 34,
    fecha_fin_rol: null,
    finca: { id_finca: 12 },
    usuario: { nombre: 'Roberto', apellido: 'Sánchez' },
  };

  beforeEach(() => {
    agro_repo = repo();
    parcela_repo = repo();
    plan_repo = repo();
    hito_repo = repo();
    usuario_finca_repo = repo();
    finca_repo = repo();
    planes_service = {
      crear_tarea_ya_finalizada: jest.fn().mockResolvedValue({
        id_tarea: 601,
        hito,
      }),
    };
    tipos_tarea_service = {
      tipo_agroquimico_activo: jest.fn().mockResolvedValue({ id_tipo_tarea: 1 }),
    };
    log_service = { registrar: jest.fn().mockResolvedValue(undefined) };
    data_source = {
      transaction: jest.fn((cb: (manager: unknown) => unknown) =>
        cb({
          getRepository: () => ({
            create: (value: unknown) => value,
            save: (value: { id_aplicacion_agroquimico?: number }) =>
              Promise.resolve({
                ...value,
                id_aplicacion_agroquimico: value.id_aplicacion_agroquimico ?? 55,
                fecha_creacion: new Date('2026-09-22T09:03:10.000Z'),
              }),
          }),
        }),
      ),
    };

    service = new AgroquimicosService(
      agro_repo as never,
      parcela_repo as never,
      plan_repo as never,
      hito_repo as never,
      usuario_finca_repo as never,
      finca_repo as never,
      planes_service as never,
      tipos_tarea_service as never,
      log_service as never,
      data_source as never,
    );
  });

  function preparar_alta() {
    parcela_repo.findOne.mockResolvedValue(parcela);
    plan_repo.find.mockResolvedValue([
      { id_plan_accion: 9, estado: EstadoPlanAccion.ACTIVO, hitos: [hito] },
    ]);
    hito_repo.findOne.mockResolvedValue(hito);
    usuario_finca_repo.findOne.mockResolvedValue(responsable);
  }

  it('registra la aplicación, crea la tarea finalizada y audita al usuario autenticado', async () => {
    preparar_alta();

    const result = await service.registrar(
      12,
      {
        fecha_hora_aplicacion_aa: '2026-09-22T09:00:00.000Z',
        nombre_producto_aa: 'Fungicida XYZ',
        dosis_aa: '2 L/ha',
        observaciones: 'Aplicar en horas de baja radiación solar',
        id_parcela: 101,
        id_hito_real: 201,
        id_responsable: 34,
      },
      ACTOR,
    );

    expect(result).toEqual({
      message: 'Aplicación registrada correctamente',
      id_aplicacion: 55,
      fecha_hora_aplicacion_aa: '2026-09-22T09:00:00.000Z',
      nombre_producto_aa: 'Fungicida XYZ',
      dosis_aa: '2 L/ha',
      observaciones: 'Aplicar en horas de baja radiación solar',
      id_parcela: 101,
      nombre_parcela: 'Parcela Norte',
      id_hito_real: 201,
      nombre_hito: 'Siembra',
      id_responsable: 34,
      nombre_responsable: 'Roberto Sánchez',
      id_tarea: 601,
      fecha_creacion: '2026-09-22T09:03:10.000Z',
    });
    expect(planes_service.crear_tarea_ya_finalizada).toHaveBeenCalledWith(
      expect.objectContaining({
        id_hito: 201,
        nombre_producto_aa: 'Fungicida XYZ',
        dosis_aa: '2 L/ha',
        responsable,
      }),
      expect.anything(),
    );
    expect(log_service.registrar).toHaveBeenCalledWith(
      expect.objectContaining({
        usuario: ACTOR,
        tipo_operacion: TipoOperacion.EXITO,
        recurso: 'AplicacionAgroquimico:55',
      }),
    );
  });

  it('rechaza el alta si la parcela no tiene un plan activo con hitos', async () => {
    parcela_repo.findOne.mockResolvedValue(parcela);
    plan_repo.find.mockResolvedValue([
      { id_plan_accion: 9, hitos: [] },
    ]);

    await expect(
      service.registrar(12, alta_dto(), ACTOR),
    ).rejects.toMatchObject({ errorCode: 'PARCEL_WITHOUT_ACTION_PLAN' });
    expect(planes_service.crear_tarea_ya_finalizada).not.toHaveBeenCalled();
  });

  it('rechaza el alta si no hay un tipo de tarea de agroquímico activo', async () => {
    preparar_alta();
    tipos_tarea_service.tipo_agroquimico_activo.mockResolvedValue(null);

    await expect(
      service.registrar(12, alta_dto(), ACTOR),
    ).rejects.toMatchObject({
      errorCode: 'AGROCHEMICAL_TASK_TYPE_UNAVAILABLE',
    });
    expect(data_source.transaction).not.toHaveBeenCalled();
  });

  it('rechaza el alta si la parcela, el hito o el responsable no pertenecen a la finca', async () => {
    parcela_repo.findOne.mockResolvedValue(null);
    await expect(
      service.registrar(12, alta_dto(), ACTOR),
    ).rejects.toMatchObject({ errorCode: 'RESOURCE_NOT_FOUND' });

    preparar_alta();
    hito_repo.findOne.mockResolvedValue(null);
    await expect(
      service.registrar(12, alta_dto(), ACTOR),
    ).rejects.toMatchObject({ errorCode: 'RESOURCE_NOT_FOUND' });

    preparar_alta();
    usuario_finca_repo.findOne.mockResolvedValue({
      ...responsable,
      finca: { id_finca: 99 },
    });
    await expect(
      service.registrar(12, alta_dto(), ACTOR),
    ).rejects.toMatchObject({ errorCode: 'RESOURCE_NOT_FOUND' });
    expect(planes_service.crear_tarea_ya_finalizada).not.toHaveBeenCalled();
  });

  it('actualiza la aplicación y propaga producto, fecha y responsable a la tarea', async () => {
    const tarea = {
      id_tarea: 601,
      nombre_tarea: 'Fungicida XYZ',
      descripcion_tarea: 'Fungicida XYZ',
      fecha_ejecucion_tarea: new Date('2026-09-22T09:00:00.000Z'),
      nombre_producto_aa: 'Fungicida XYZ',
      dosis_aa: '2 L/ha',
      fecha_hora_aplicacion_aa: new Date('2026-09-22T09:00:00.000Z'),
      responsable,
      hito,
    };
    const aplicacion = {
      id_aplicacion_agroquimico: 55,
      nombre_producto_aa: 'Fungicida XYZ',
      dosis_aa: '2 L/ha',
      fecha_hora_aplicacion_aa: new Date('2026-09-22T09:00:00.000Z'),
      observaciones: 'Aplicar en horas de baja radiación solar',
      fecha_creacion: new Date('2026-09-22T09:03:10.000Z'),
      fecha_modificacion: new Date('2026-09-22T09:03:10.000Z'),
      parcela,
      responsable,
      tarea,
    };
    const nuevo_responsable = {
      id_usuario_finca: 41,
      fecha_fin_rol: null,
      finca: { id_finca: 12 },
      usuario: { nombre: 'Ana', apellido: 'López' },
    };
    agro_repo.findOne.mockResolvedValue(aplicacion);
    usuario_finca_repo.findOne.mockResolvedValue(nuevo_responsable);
    data_source.transaction.mockImplementation(
      (cb: (manager: unknown) => unknown) =>
        cb({
          getRepository: () => ({
            save: (entity: {
              id_aplicacion_agroquimico?: number;
              fecha_modificacion?: Date;
            }) => {
              if (entity.id_aplicacion_agroquimico != null) {
                entity.fecha_modificacion = new Date('2026-09-22T11:00:00.000Z');
              }
              return Promise.resolve(entity);
            },
          }),
        }),
    );

    const result = await service.actualizar(
      12,
      55,
      {
        fecha_hora_aplicacion_aa: '2026-09-22T10:30:00.000Z',
        nombre_producto_aa: 'Fungicida XYZ Plus',
        dosis_aa: '2.5 L/ha',
        observaciones: 'Se reprogramó por lluvia',
        id_responsable: 41,
      },
      ACTOR,
    );

    expect(result.message).toBe('Aplicación actualizada correctamente');
    expect(result.fecha_modificacion).toBe('2026-09-22T11:00:00.000Z');
    expect(result.nombre_responsable).toBe('Ana López');
    expect(tarea).toEqual(
      expect.objectContaining({
        nombre_tarea: 'Fungicida XYZ Plus',
        descripcion_tarea: 'Fungicida XYZ Plus',
        nombre_producto_aa: 'Fungicida XYZ Plus',
        dosis_aa: '2.5 L/ha',
        fecha_ejecucion_tarea: new Date('2026-09-22T10:30:00.000Z'),
        fecha_hora_aplicacion_aa: new Date('2026-09-22T10:30:00.000Z'),
        responsable: nuevo_responsable,
      }),
    );
    expect(log_service.registrar).toHaveBeenCalledWith(
      expect.objectContaining({
        recurso: 'AplicacionAgroquimico:55',
        tipo_operacion: TipoOperacion.EXITO,
      }),
    );
  });

  it('rechaza la edición si la tarea vinculada ya no existe', async () => {
    agro_repo.findOne.mockResolvedValue({
      id_aplicacion_agroquimico: 55,
      parcela,
      tarea: null,
    });

    await expect(
      service.actualizar(12, 55, edicion_dto(), ACTOR),
    ).rejects.toMatchObject({ errorCode: 'LINKED_TASK_DELETED' });
    expect(data_source.transaction).not.toHaveBeenCalled();
  });

  it('lista por fecha descendente aplicando los filtros combinados', async () => {
    const builder = query_builder(
      [
        {
          id_aplicacion_agroquimico: 55,
          fecha_hora_aplicacion_aa: new Date('2026-09-22T09:00:00.000Z'),
          nombre_producto_aa: 'Fungicida XYZ',
          dosis_aa: '2 L/ha',
          parcela,
          responsable,
        },
      ],
      1,
    );
    agro_repo.createQueryBuilder.mockReturnValue(builder);
    parcela_repo.findOne.mockResolvedValue(parcela);
    usuario_finca_repo.findOne.mockResolvedValue({
      ...responsable,
      fecha_fin_rol: new Date('2020-01-01T00:00:00.000Z'),
    });

    const result = await service.listar(12, {
      page: 1,
      pageSize: 10,
      id_parcela: 101,
      fecha_desde: '2026-09-01',
      fecha_hasta: '2026-09-30',
      id_responsable: 34,
    });

    expect(result).toEqual({
      aplicaciones: [
        {
          id_aplicacion: 55,
          fecha_hora_aplicacion_aa: '2026-09-22T09:00:00.000Z',
          nombre_producto_aa: 'Fungicida XYZ',
          dosis_aa: '2 L/ha',
          id_parcela: 101,
          nombre_parcela: 'Parcela Norte',
          id_responsable: 34,
          nombre_responsable: 'Roberto Sánchez',
        },
      ],
      total: 1,
      page: 1,
      pageSize: 10,
    });
    expect(builder.orderBy).toHaveBeenCalledWith(
      'aplicacion.fecha_hora_aplicacion_aa',
      'DESC',
      'NULLS LAST',
    );
    expect(builder.andWhere).toHaveBeenCalledWith(
      'parcela.id_parcela = :id_parcela',
      { id_parcela: 101 },
    );
    expect(builder.andWhere).toHaveBeenCalledWith(
      'aplicacion.fecha_hora_aplicacion_aa >= :fecha_desde',
      { fecha_desde: new Date('2026-09-01T00:00:00.000Z') },
    );
    expect(builder.andWhere).toHaveBeenCalledWith(
      'aplicacion.fecha_hora_aplicacion_aa < :fecha_hasta',
      { fecha_hasta: new Date('2026-10-01T00:00:00.000Z') },
    );
  });

  it('rechaza un rango de fechas invertido en el listado y en la exportación', async () => {
    await expect(
      service.listar(12, {
        fecha_desde: '2026-09-30',
        fecha_hasta: '2026-09-01',
      }),
    ).rejects.toMatchObject({ errorCode: 'INVALID_DATE_RANGE' });
    await expect(
      service.exportar(12, {
        fecha_desde: '2026-09-30',
        fecha_hasta: '2026-09-01',
      }),
    ).rejects.toMatchObject({ errorCode: 'INVALID_DATE_RANGE' });
    expect(agro_repo.createQueryBuilder).not.toHaveBeenCalled();
  });

  it('no genera el PDF si los filtros no devuelven aplicaciones', async () => {
    finca_repo.findOne.mockResolvedValue({
      id_finca: 12,
      nombre_finca: 'Finca Demo Croply',
    });
    agro_repo.createQueryBuilder.mockReturnValue(query_builder([]));

    await expect(service.exportar(12, {})).rejects.toMatchObject({
      errorCode: 'EMPTY_EXPORT_RESULT',
    });
  });

  it('arma un PDF con el historial cuando hay aplicaciones', async () => {
    finca_repo.findOne.mockResolvedValue({
      id_finca: 12,
      nombre_finca: 'Finca Demo Croply',
    });
    parcela_repo.findOne.mockResolvedValue(parcela);
    agro_repo.createQueryBuilder.mockReturnValue(
      query_builder([
        {
          id_aplicacion_agroquimico: 55,
          fecha_hora_aplicacion_aa: new Date('2026-09-22T09:00:00.000Z'),
          nombre_producto_aa: 'Fungicida XYZ',
          dosis_aa: '2 L/ha',
          parcela,
          responsable,
        },
      ]),
    );

    const archivo = await service.exportar(12, {
      fecha_desde: '2026-09-01',
      fecha_hasta: '2026-09-30',
      id_parcela: 101,
    });

    expect(archivo.filename).toMatch(
      /^agroquimicos_finca-demo-croply_\d{4}-\d{2}-\d{2}\.pdf$/,
    );
    const texto = archivo.buffer.toString('latin1');
    expect(texto.startsWith('%PDF')).toBe(true);
    expect(texto).toContain(hex_pdf('Croply'));
    expect(texto).toContain(hex_pdf('Fungicida XYZ'));
    expect(texto).toContain(hex_pdf('2 L/ha'));
    expect(texto).toContain(hex_pdf('2026-09-01 a 2026-09-30'));
  });
});

function hex_pdf(texto: string): string {
  return Buffer.from(texto, 'latin1').toString('hex');
}

function alta_dto() {
  return {
    fecha_hora_aplicacion_aa: '2026-09-22T09:00:00.000Z',
    nombre_producto_aa: 'Fungicida XYZ',
    dosis_aa: '2 L/ha',
    id_parcela: 101,
    id_hito_real: 201,
    id_responsable: 34,
  };
}

function edicion_dto() {
  return {
    fecha_hora_aplicacion_aa: '2026-09-22T10:30:00.000Z',
    nombre_producto_aa: 'Fungicida XYZ Plus',
    dosis_aa: '2.5 L/ha',
    id_responsable: 41,
  };
}
