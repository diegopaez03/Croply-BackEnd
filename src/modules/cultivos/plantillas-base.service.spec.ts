import { HttpStatus } from '@nestjs/common';
import { EpocaCultivo, FormaSiembra } from '../../common/enums';
import { PlantillaBase } from './entities/plantilla-base.entity';
import { PlantillaCultivoVariedad } from './entities/plantilla-cultivo-variedad.entity';
import { HitoPlantilla } from './entities/hito-plantilla.entity';
import { TareaPlantilla } from './entities/tarea-plantilla.entity';
import { PlantillasBaseService } from './plantillas-base.service';
import { CrearPlantillaBaseDto } from './dto/crear-plantilla-base.dto';

const ACTOR = { id_usuario: 1 } as never;

const dto_crear: CrearPlantillaBaseDto = {
  nombre_pb: 'Plan de Cultivo de Tomate',
  cultivos: [{ id_cultivo_base: 45, id_variedad: 12 }],
  hitos: [
    {
      nombre_hpb: 'Siembra',
      orden_hpb: 1,
      tareas: [
        {
          dia_relativo_tp: 0,
          id_tipo_tarea: 2,
          descripcion_tp: 'Preparación de almácigo',
        },
      ],
    },
  ],
};

function cultivo_tomate() {
  return {
    id_cultivo_base: 45,
    nombre_cultivo_base: 'Tomate',
    descripcion_cb: 'Fruto nacional premium',
    epoca_cultivo: EpocaCultivo.PRIMAVERA_VERANO,
    mes_siembra: 'Sep-Oct',
    ciclo_productivo_cb: '70-90 días',
    forma_siembra: FormaSiembra.ALMACIGO,
    fecha_baja_cb: null,
  };
}

function variedad_perita() {
  return {
    id_variedad: 12,
    nombre_variedad: 'Perita',
    distancia_plantacion: '30x60cm',
    observaciones: 'Mas dulce, con menos semillas.',
    dias_a_cosecha: 75,
    fecha_alta: new Date('2026-03-10T00:00:00Z'),
    fecha_baja: null,
    cultivo_base: cultivo_tomate(),
  };
}

function plantilla_detalle() {
  return {
    id_plantilla_base: 3,
    nombre_pb: 'Plan de Cultivo de Tomate',
    fecha_baja_pb: null,
    plantilla_cultivo_variedades: [
      {
        id_pbcv: 24,
        cultivo_base: cultivo_tomate(),
        variedad: variedad_perita(),
      },
    ],
    hitos: [
      {
        id_hito_plantilla: 10,
        nombre_hpb: 'Siembra',
        orden_hpb: 1,
        tareas: [
          {
            id_tarea_plantilla: 33,
            dia_relativo_tp: 0,
            id_tipo_tarea: 2,
            descripcion_tp: 'Preparación de almácigo',
          },
        ],
      },
    ],
  };
}

describe('PlantillasBaseService', () => {
  let service: PlantillasBaseService;
  let plantilla_repo: Record<string, jest.Mock>;
  let pcv_repo: Record<string, jest.Mock>;
  let hito_repo: Record<string, jest.Mock>;
  let tarea_repo: Record<string, jest.Mock>;
  let cultivo_repo: Record<string, jest.Mock>;
  let variedad_repo: Record<string, jest.Mock>;
  let data_source: { transaction: jest.Mock };
  let log_service: { registrar: jest.Mock };

  beforeEach(() => {
    plantilla_repo = {
      find: jest.fn(),
      findOne: jest.fn(),
      findAndCount: jest.fn(),
      save: jest.fn(async (x) => ({
        id_plantilla_base: 3,
        fecha_baja_pb: null,
        ...x,
      })),
      create: jest.fn((x) => x),
    };
    pcv_repo = {
      find: jest.fn().mockResolvedValue([]),
      save: jest.fn(async (x) => ({ id_pbcv: 24, ...x })),
      create: jest.fn((x) => x),
      delete: jest.fn(),
    };
    hito_repo = {
      find: jest.fn().mockResolvedValue([]),
      save: jest.fn(async (x) => ({ id_hito_plantilla: 10, ...x })),
      create: jest.fn((x) => x),
      delete: jest.fn(),
    };
    tarea_repo = {
      save: jest.fn(async (x) => ({ id_tarea_plantilla: 33, ...x })),
      create: jest.fn((x) => x),
      delete: jest.fn(),
    };
    cultivo_repo = {
      findOne: jest.fn().mockResolvedValue(cultivo_tomate()),
    };
    variedad_repo = {
      findOne: jest.fn().mockResolvedValue(variedad_perita()),
    };
    const repos = new Map<unknown, Record<string, jest.Mock>>([
      [PlantillaBase, plantilla_repo],
      [PlantillaCultivoVariedad, pcv_repo],
      [HitoPlantilla, hito_repo],
      [TareaPlantilla, tarea_repo],
    ]);
    data_source = {
      transaction: jest.fn(async (cb: (m: unknown) => unknown) =>
        cb({
          getRepository: (entity: unknown) => repos.get(entity),
        }),
      ),
    };
    log_service = { registrar: jest.fn().mockResolvedValue(undefined) };

    service = new PlantillasBaseService(
      plantilla_repo as never,
      pcv_repo as never,
      hito_repo as never,
      tarea_repo as never,
      cultivo_repo as never,
      variedad_repo as never,
      data_source as never,
      log_service as never,
    );
  });

  it('crea una plantilla y devuelve el detalle', async () => {
    plantilla_repo.findOne
      .mockResolvedValueOnce(null)
      .mockResolvedValueOnce(plantilla_detalle());

    const result = await service.crear(dto_crear, ACTOR);

    expect(result.message).toBe('Plantilla creada correctamente');
    expect(result.id_plantilla_base).toBe(3);
    expect(result.hitos[0].tareas[0].nombre_tipo_tarea).toBe('Siembra');
    expect(result.cultivos[0].variedad).toMatchObject({
      id_variedad: 12,
      nombre_variedad: 'Perita',
    });
  });

  it('rechaza una plantilla sin hitos con tareas', async () => {
    await expect(
      service.crear(
        {
          ...dto_crear,
          hitos: [{ nombre_hpb: 'Siembra', orden_hpb: 1, tareas: [] }],
        },
        ACTOR,
      ),
    ).rejects.toMatchObject({
      errorCode: 'EMPTY_SCHEDULE',
      status: HttpStatus.BAD_REQUEST,
    });
  });

  it('rechaza nombre de plantilla duplicado', async () => {
    plantilla_repo.findOne.mockResolvedValue(plantilla_detalle());

    await expect(service.crear(dto_crear, ACTOR)).rejects.toMatchObject({
      errorCode: 'DUPLICATE_VALUE',
      status: HttpStatus.CONFLICT,
    });
  });

  it('rechaza variedad ya asignada a otra plantilla', async () => {
    plantilla_repo.findOne.mockResolvedValue(null);
    pcv_repo.find.mockResolvedValue([
      {
        variedad: { id_variedad: 12 },
        cultivo_base: { id_cultivo_base: 45 },
        plantilla_base: { id_plantilla_base: 99, fecha_baja_pb: null },
      },
    ]);

    await expect(service.crear(dto_crear, ACTOR)).rejects.toMatchObject({
      errorCode: 'VARIETY_ALREADY_ASSIGNED',
      status: HttpStatus.CONFLICT,
    });
  });

  it('lista plantillas paginadas con cantidad de tareas', async () => {
    plantilla_repo.findAndCount.mockResolvedValue([
      [
        {
          id_plantilla_base: 3,
          nombre_pb: 'Plan de Cultivo de Ajo',
          plantilla_cultivo_variedades: [
            {
              id_pbcv: 23,
              cultivo_base: { id_cultivo_base: 45 },
              variedad: null,
            },
          ],
          hitos: [
            { tareas: [{}, {}] },
            { tareas: [{}] },
          ],
        },
      ],
      1,
    ]);

    const result = await service.listar({ page: 1, pageSize: 10 });

    expect(result.plantillas).toEqual([
      {
        id_plantilla_base: 3,
        nombre_pb: 'Plan de Cultivo de Ajo',
        cultivos: [
          { id_pbcv: 23, id_cultivo_base: 45, id_variedad: null },
        ],
        cantidad_tareas: 3,
      },
    ]);
    expect(result.pagination).toEqual({
      page: 1,
      pageSize: 10,
      totalItems: 1,
      totalPages: 1,
    });
  });

  it('da de baja lógica una plantilla aunque esté asociada', async () => {
    plantilla_repo.findOne.mockResolvedValue({
      id_plantilla_base: 3,
      nombre_pb: 'Plan de Cultivo de Tomate',
      fecha_baja_pb: null,
    });

    const result = await service.dar_baja(3, ACTOR);

    expect(result.message).toBe('Plantilla eliminada correctamente');
    expect(plantilla_repo.save).toHaveBeenCalledWith(
      expect.objectContaining({ fecha_baja_pb: expect.any(Date) }),
    );
  });

  it('actualiza una plantilla reemplazando hitos y cultivos', async () => {
    plantilla_repo.findOne
      .mockResolvedValueOnce({
        id_plantilla_base: 3,
        nombre_pb: 'Viejo',
        fecha_baja_pb: null,
      })
      .mockResolvedValueOnce(null)
      .mockResolvedValueOnce(plantilla_detalle());

    const result = await service.actualizar(3, dto_crear, ACTOR);

    expect(result.message).toBe('Plantilla actualizada correctamente');
    expect(pcv_repo.delete).toHaveBeenCalled();
    expect(hito_repo.delete).toHaveBeenCalled();
  });
});
