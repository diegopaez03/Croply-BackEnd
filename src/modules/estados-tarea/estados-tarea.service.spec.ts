import { HttpStatus } from '@nestjs/common';
import { TipoOperacion } from '../../common/enums';
import { EstadosTareaService } from './estados-tarea.service';

describe('EstadosTareaService', () => {
  let service: EstadosTareaService;
  let estado_tarea_repo: Record<string, jest.Mock>;
  let tarea_repo: { count: jest.Mock };
  let log_service: { registrar: jest.Mock };

  beforeEach(() => {
    estado_tarea_repo = {
      find: jest.fn(),
      findOne: jest.fn(),
      save: jest.fn(async (estado) => ({
        id_estado_tarea: 4,
        ...estado,
      })),
      create: jest.fn((estado) => estado),
    };
    tarea_repo = { count: jest.fn().mockResolvedValue(0) };
    log_service = { registrar: jest.fn().mockResolvedValue(undefined) };

    service = new EstadosTareaService(
      estado_tarea_repo as never,
      tarea_repo as never,
      log_service as never,
    );
  });

  it('lista solo estados activos con sus flags', async () => {
    estado_tarea_repo.find.mockResolvedValue([
      {
        id_estado_tarea: 2,
        nombre_estado_tarea: 'Completado',
        protegido: true,
        es_estado_finalizador: true,
        cuenta_para_cierre_exitoso: true,
      },
    ]);

    await expect(service.listar()).resolves.toEqual({
      estados_tarea: [
        {
          id_estado_tarea: 2,
          nombre_estado_tarea: 'Completado',
          protegido: true,
          es_estado_finalizador: true,
          cuenta_para_cierre_exitoso: true,
        },
      ],
    });
  });

  it('crea un estado con los tres flags en false', async () => {
    estado_tarea_repo.findOne.mockResolvedValue(null);

    const result = await service.crear(
      { nombre_estado_tarea: 'En Progreso' },
      { id_usuario: 1 } as never,
    );

    expect(estado_tarea_repo.create).toHaveBeenCalledWith(
      expect.objectContaining({
        nombre_estado_tarea: 'En Progreso',
        protegido: false,
        es_estado_finalizador: false,
        cuenta_para_cierre_exitoso: false,
      }),
    );
    expect(result.message).toBe('Estado de tarea creado correctamente');
    expect(log_service.registrar).toHaveBeenCalledWith(
      expect.objectContaining({ tipo_operacion: TipoOperacion.EXITO }),
    );
  });

  it('rechaza un nombre duplicado', async () => {
    estado_tarea_repo.findOne.mockResolvedValue({ id_estado_tarea: 1 });

    await expect(
      service.crear(
        { nombre_estado_tarea: 'Planificado' },
        { id_usuario: 1 } as never,
      ),
    ).rejects.toMatchObject({
      errorCode: 'DUPLICATE_VALUE',
      field: 'nombre_estado_tarea',
      status: HttpStatus.CONFLICT,
    });
  });

  it('bloquea la baja protegida antes de consultar tareas asociadas', async () => {
    estado_tarea_repo.findOne.mockResolvedValue({
      id_estado_tarea: 1,
      nombre_estado_tarea: 'Planificado',
      protegido: true,
    });

    await expect(
      service.dar_baja(1, { id_usuario: 1 } as never),
    ).rejects.toMatchObject({
      errorCode: 'PROTECTED_CATALOG_ITEM',
      status: HttpStatus.CONFLICT,
    });
    expect(tarea_repo.count).not.toHaveBeenCalled();
  });

  it('rechaza la baja si hay tareas en ese estado', async () => {
    estado_tarea_repo.findOne.mockResolvedValue({
      id_estado_tarea: 4,
      nombre_estado_tarea: 'En Progreso',
      protegido: false,
    });
    tarea_repo.count.mockResolvedValue(2);

    await expect(
      service.dar_baja(4, { id_usuario: 1 } as never),
    ).rejects.toMatchObject({
      errorCode: 'RESOURCE_IN_USE',
      status: HttpStatus.CONFLICT,
    });
  });

  it('resuelve Planificado y Cancelada por flags, no por nombre', async () => {
    estado_tarea_repo.findOne.mockImplementation(async ({ where }) => {
      if (
        where.es_estado_finalizador === false &&
        where.cuenta_para_cierre_exitoso === false
      ) {
        return {
          id_estado_tarea: 1,
          nombre_estado_tarea: 'A programar',
          protegido: true,
          es_estado_finalizador: false,
          cuenta_para_cierre_exitoso: false,
        };
      }
      if (
        where.es_estado_finalizador === true &&
        where.cuenta_para_cierre_exitoso === false
      ) {
        return {
          id_estado_tarea: 3,
          nombre_estado_tarea: 'Anulada',
          protegido: true,
          es_estado_finalizador: true,
          cuenta_para_cierre_exitoso: false,
        };
      }
      return null;
    });

    await expect(service.estado_inicial()).resolves.toMatchObject({
      id_estado_tarea: 1,
    });
    await expect(service.estado_cancelada()).resolves.toMatchObject({
      id_estado_tarea: 3,
    });
  });

  it('siembra las tres filas protegidas y no las duplica', async () => {
    estado_tarea_repo.findOne.mockResolvedValue(null);

    await service.ensure_seed();

    expect(estado_tarea_repo.create).toHaveBeenCalledTimes(3);
    expect(estado_tarea_repo.create).toHaveBeenCalledWith(
      expect.objectContaining({
        nombre_estado_tarea: 'Completado',
        protegido: true,
        es_estado_finalizador: true,
        cuenta_para_cierre_exitoso: true,
      }),
    );

    estado_tarea_repo.create.mockClear();
    estado_tarea_repo.findOne.mockResolvedValue({ id_estado_tarea: 1 });
    await service.ensure_seed();
    expect(estado_tarea_repo.create).not.toHaveBeenCalled();
  });
});
