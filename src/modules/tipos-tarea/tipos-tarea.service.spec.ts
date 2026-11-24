import { HttpStatus } from '@nestjs/common';
import { TipoOperacion } from '../../common/enums';
import { TiposTareaService } from './tipos-tarea.service';

describe('TiposTareaService', () => {
  let service: TiposTareaService;
  let tipo_tarea_repo: Record<string, jest.Mock>;
  let tarea_repo: { count: jest.Mock };
  let tarea_plantilla_repo: { count: jest.Mock };
  let log_service: { registrar: jest.Mock };

  beforeEach(() => {
    tipo_tarea_repo = {
      find: jest.fn(),
      findOne: jest.fn(),
      save: jest.fn(async (tipo) => ({
        id_tipo_tarea: 8,
        fecha_alta_tipo_tarea: new Date('2026-09-20T00:00:00.000Z'),
        fecha_baja_tipo_tarea: null,
        protegido: false,
        es_tipo_agroquimico: false,
        ...tipo,
      })),
      create: jest.fn((tipo) => tipo),
    };
    tarea_repo = { count: jest.fn().mockResolvedValue(0) };
    tarea_plantilla_repo = { count: jest.fn().mockResolvedValue(0) };
    log_service = { registrar: jest.fn().mockResolvedValue(undefined) };

    service = new TiposTareaService(
      tipo_tarea_repo as never,
      tarea_repo as never,
      tarea_plantilla_repo as never,
      log_service as never,
    );
  });

  it('lista solo tipos activos con sus flags', async () => {
    tipo_tarea_repo.find.mockResolvedValue([
      {
        id_tipo_tarea: 1,
        nombre_tipo_tarea: 'Aplicación de agroquímico',
        protegido: true,
        es_tipo_agroquimico: true,
      },
    ]);

    await expect(service.listar()).resolves.toEqual({
      tipos_tarea: [
        {
          id_tipo_tarea: 1,
          nombre_tipo_tarea: 'Aplicación de agroquímico',
          protegido: true,
          es_tipo_agroquimico: true,
        },
      ],
    });
  });

  it('crea un tipo con ambos flags en false', async () => {
    tipo_tarea_repo.findOne.mockResolvedValue(null);

    const result = await service.crear(
      { nombre_tipo_tarea: '  Poda  ' },
      { id_usuario: 1 } as never,
    );

    expect(tipo_tarea_repo.create).toHaveBeenCalledWith(
      expect.objectContaining({
        nombre_tipo_tarea: 'Poda',
        protegido: false,
        es_tipo_agroquimico: false,
      }),
    );
    expect(result).toMatchObject({
      message: 'Tipo de tarea creado correctamente',
      nombre_tipo_tarea: 'Poda',
      protegido: false,
      es_tipo_agroquimico: false,
    });
    expect(log_service.registrar).toHaveBeenCalledWith(
      expect.objectContaining({ tipo_operacion: TipoOperacion.EXITO }),
    );
  });

  it('rechaza un nombre duplicado entre activos', async () => {
    tipo_tarea_repo.findOne.mockResolvedValue({
      id_tipo_tarea: 2,
      nombre_tipo_tarea: 'Siembra',
    });

    await expect(
      service.crear({ nombre_tipo_tarea: 'Siembra' }, { id_usuario: 1 } as never),
    ).rejects.toMatchObject({
      errorCode: 'DUPLICATE_VALUE',
      status: HttpStatus.CONFLICT,
      field: 'nombre_tipo_tarea',
    });
    expect(tipo_tarea_repo.save).not.toHaveBeenCalled();
  });

  it('permite renombrar una fila protegida sin tocar los flags', async () => {
    tipo_tarea_repo.findOne
      .mockResolvedValueOnce({
        id_tipo_tarea: 1,
        nombre_tipo_tarea: 'Aplicación de agroquímico',
        protegido: true,
        es_tipo_agroquimico: true,
        fecha_baja_tipo_tarea: null,
      })
      .mockResolvedValueOnce(null);

    const result = await service.actualizar(
      1,
      { nombre_tipo_tarea: 'Aplicación fitosanitaria' },
      { id_usuario: 1 } as never,
    );

    expect(tipo_tarea_repo.save).toHaveBeenCalledWith(
      expect.objectContaining({
        nombre_tipo_tarea: 'Aplicación fitosanitaria',
        protegido: true,
        es_tipo_agroquimico: true,
      }),
    );
    expect(result.protegido).toBe(true);
    expect(result.es_tipo_agroquimico).toBe(true);
  });

  it('bloquea la baja de una fila protegida antes de mirar si está en uso', async () => {
    tipo_tarea_repo.findOne.mockResolvedValue({
      id_tipo_tarea: 1,
      nombre_tipo_tarea: 'Aplicación de agroquímico',
      protegido: true,
      es_tipo_agroquimico: true,
    });
    tarea_repo.count.mockResolvedValue(4);

    await expect(
      service.dar_baja(1, { id_usuario: 1 } as never),
    ).rejects.toMatchObject({
      errorCode: 'PROTECTED_CATALOG_ITEM',
      status: HttpStatus.CONFLICT,
    });
    expect(tarea_repo.count).not.toHaveBeenCalled();
  });

  it('rechaza la baja si hay tareas o plantillas asociadas', async () => {
    tipo_tarea_repo.findOne.mockResolvedValue({
      id_tipo_tarea: 2,
      nombre_tipo_tarea: 'Siembra',
      protegido: false,
      es_tipo_agroquimico: false,
    });
    tarea_plantilla_repo.count.mockResolvedValue(1);

    await expect(
      service.dar_baja(2, { id_usuario: 1 } as never),
    ).rejects.toMatchObject({
      errorCode: 'RESOURCE_IN_USE',
      status: HttpStatus.CONFLICT,
    });
    expect(tipo_tarea_repo.save).not.toHaveBeenCalled();
  });

  it('da de baja lógica un tipo libre y audita la operación', async () => {
    tipo_tarea_repo.findOne.mockResolvedValue({
      id_tipo_tarea: 2,
      nombre_tipo_tarea: 'Siembra',
      protegido: false,
      es_tipo_agroquimico: false,
      fecha_baja_tipo_tarea: null,
    });

    const result = await service.dar_baja(2, { id_usuario: 1 } as never);

    expect(result.message).toBe('Tipo de tarea dado de baja correctamente');
    expect(tipo_tarea_repo.save).toHaveBeenCalledWith(
      expect.objectContaining({
        fecha_baja_tipo_tarea: expect.any(Date),
      }),
    );
    expect(log_service.registrar).toHaveBeenCalledWith(
      expect.objectContaining({
        tipo_operacion: TipoOperacion.OPERACION_DESTRUCTIVA,
      }),
    );
  });

  it('siembra Aplicación de agroquímico solo si no existe la fila protegida', async () => {
    tipo_tarea_repo.findOne.mockResolvedValueOnce(null);

    await service.ensure_seed();

    expect(tipo_tarea_repo.create).toHaveBeenCalledWith(
      expect.objectContaining({
        nombre_tipo_tarea: 'Aplicación de agroquímico',
        protegido: true,
        es_tipo_agroquimico: true,
      }),
    );

    tipo_tarea_repo.create.mockClear();
    tipo_tarea_repo.findOne.mockResolvedValueOnce({ id_tipo_tarea: 1 });
    await service.ensure_seed();
    expect(tipo_tarea_repo.create).not.toHaveBeenCalled();
  });
});
