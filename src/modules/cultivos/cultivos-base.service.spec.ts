import { HttpStatus } from '@nestjs/common';
import { EpocaCultivo, FormaSiembra } from '../../common/enums';
import { CultivosBaseService } from './cultivos-base.service';
import { CrearCultivoBaseDto } from './dto/crear-cultivo-base.dto';

const ACTOR = { id_usuario: 1 } as never;

const dto_tomate: CrearCultivoBaseDto = {
  nombre_cultivo_base: 'Tomate',
  descripcion_cb: 'Fruto nacional premium',
  epoca_cultivo: EpocaCultivo.PRIMAVERA_VERANO,
  mes_siembra: 'Sep-Oct',
  ciclo_productivo_cb: '70-90 días',
  forma_siembra: FormaSiembra.ALMACIGO,
};

function cultivo_tomate(overrides: Record<string, unknown> = {}) {
  return {
    id_cultivo_base: 45,
    nombre_cultivo_base: 'Tomate',
    descripcion_cb: 'Fruto nacional premium',
    epoca_cultivo: EpocaCultivo.PRIMAVERA_VERANO,
    mes_siembra: 'Sep-Oct',
    ciclo_productivo_cb: '70-90 días',
    forma_siembra: FormaSiembra.ALMACIGO,
    fecha_alta_cb: new Date('2026-03-10T00:00:00Z'),
    fecha_baja_cb: null,
    variedades: [],
    ...overrides,
  };
}

describe('CultivosBaseService', () => {
  let service: CultivosBaseService;
  let cultivo_repo: Record<string, jest.Mock>;
  let variedad_repo: Record<string, jest.Mock>;
  let pcv_repo: Record<string, jest.Mock>;
  let log_service: { registrar: jest.Mock };

  beforeEach(() => {
    cultivo_repo = {
      find: jest.fn(),
      findOne: jest.fn(),
      save: jest.fn(async (x) => ({
        id_cultivo_base: 45,
        fecha_alta_cb: new Date('2026-03-10T00:00:00Z'),
        fecha_baja_cb: null,
        ...x,
      })),
      create: jest.fn((x) => x),
    };
    variedad_repo = {
      find: jest.fn(),
      findOne: jest.fn(),
      save: jest.fn(async (x) => ({
        id_variedad: 12,
        fecha_alta: new Date('2026-03-10T00:00:00Z'),
        fecha_baja: null,
        ...x,
      })),
      create: jest.fn((x) => x),
    };
    pcv_repo = {
      find: jest.fn().mockResolvedValue([]),
    };
    log_service = { registrar: jest.fn().mockResolvedValue(undefined) };

    service = new CultivosBaseService(
      cultivo_repo as never,
      variedad_repo as never,
      pcv_repo as never,
      log_service as never,
    );
  });

  it('crea un cultivo y devuelve la ficha técnica', async () => {
    cultivo_repo.findOne.mockResolvedValue(null);

    const result = await service.crear(dto_tomate, ACTOR);

    expect(result.message).toBe('Cultivo creado correctamente');
    expect(result.id_cultivo_base).toBe(45);
    expect(result.nombre_cultivo_base).toBe('Tomate');
    expect(result.ciclo_productivo_cb).toBe('70-90 días');
    expect(result.forma_siembra).toBe(FormaSiembra.ALMACIGO);
  });

  it('rechaza un cultivo con nombre duplicado', async () => {
    cultivo_repo.findOne.mockResolvedValue(cultivo_tomate());

    await expect(service.crear(dto_tomate, ACTOR)).rejects.toMatchObject({
      errorCode: 'DUPLICATE_VALUE',
      status: HttpStatus.CONFLICT,
    });
  });

  it('lista cultivos activos con cantidad de variedades', async () => {
    cultivo_repo.find.mockResolvedValue([
      cultivo_tomate({
        variedades: [
          { id_variedad: 12, fecha_baja: null },
          { id_variedad: 13, fecha_baja: new Date() },
        ],
      }),
    ]);

    const { cultivos } = await service.listar({});

    expect(cultivos).toHaveLength(1);
    expect(cultivos[0]).toMatchObject({
      id_cultivo_base: 45,
      nombre_cultivo_base: 'Tomate',
      mes_siembra: 'Sep-Oct',
      cantidad_variedades: 1,
    });
  });

  it('filtra por búsqueda insensible a mayúsculas', async () => {
    cultivo_repo.find.mockResolvedValue([
      cultivo_tomate(),
      cultivo_tomate({
        id_cultivo_base: 2,
        nombre_cultivo_base: 'Lechuga',
      }),
    ]);

    const { cultivos } = await service.listar({ search: 'TOM' });

    expect(cultivos).toHaveLength(1);
    expect(cultivos[0].nombre_cultivo_base).toBe('Tomate');
  });

  it('no filtra por época cuando vale Todo_el_anio', async () => {
    cultivo_repo.find.mockResolvedValue([
      cultivo_tomate(),
      cultivo_tomate({
        id_cultivo_base: 2,
        nombre_cultivo_base: 'Ajo',
        epoca_cultivo: EpocaCultivo.OTONIO_INVIERNO,
      }),
    ]);

    const { cultivos } = await service.listar({
      epoca_cultivo: EpocaCultivo.TODO_EL_ANIO,
    });

    expect(cultivos).toHaveLength(2);
  });

  it('filtra por época de cultivo', async () => {
    cultivo_repo.find.mockResolvedValue([
      cultivo_tomate(),
      cultivo_tomate({
        id_cultivo_base: 2,
        nombre_cultivo_base: 'Ajo',
        epoca_cultivo: EpocaCultivo.OTONIO_INVIERNO,
      }),
    ]);

    const { cultivos } = await service.listar({
      epoca_cultivo: EpocaCultivo.PRIMAVERA_VERANO,
    });

    expect(cultivos).toHaveLength(1);
    expect(cultivos[0].nombre_cultivo_base).toBe('Tomate');
  });

  it('devuelve lista vacía si no hay coincidencias', async () => {
    cultivo_repo.find.mockResolvedValue([cultivo_tomate()]);

    const { cultivos } = await service.listar({ search: 'inexistente' });

    expect(cultivos).toEqual([]);
  });

  it('devuelve el detalle con variedades, en_uso y plantillas calculadas', async () => {
    cultivo_repo.findOne.mockResolvedValue(
      cultivo_tomate({
        variedades: [
          {
            id_variedad: 12,
            nombre_variedad: 'Perita',
            distancia_plantacion: '30x60cm',
            observaciones: 'Mas dulce, con menos semillas.',
            dias_a_cosecha: 75,
            fecha_alta: new Date('2026-03-10T00:00:00Z'),
            fecha_baja: null,
          },
          {
            id_variedad: 13,
            nombre_variedad: 'Redondo',
            distancia_plantacion: '40x70cm',
            observaciones: null,
            dias_a_cosecha: 68,
            fecha_alta: new Date('2026-03-11T00:00:00Z'),
            fecha_baja: null,
          },
        ],
      }),
    );
    pcv_repo.find.mockResolvedValue([
      {
        variedad: null,
        plantilla_base: { id_plantilla_base: 3, fecha_baja_pb: null },
      },
      {
        variedad: { id_variedad: 12 },
        plantilla_base: { id_plantilla_base: 8, fecha_baja_pb: null },
      },
    ]);

    const detalle = await service.detalle(45);

    expect(detalle.id_plantilla_general).toBe(3);
    expect(detalle.variedades[0]).toMatchObject({
      id_variedad: 12,
      nombre_variedad: 'Perita',
      fecha_alta: '2026-03-10',
      en_uso: true,
      id_plantilla_especifica: 8,
    });
    expect(detalle.variedades[1]).toMatchObject({
      id_variedad: 13,
      en_uso: false,
      id_plantilla_especifica: null,
    });
  });

  it('rechaza detalle de cultivo inexistente o dado de baja', async () => {
    cultivo_repo.findOne.mockResolvedValue(null);

    await expect(service.detalle(99)).rejects.toMatchObject({
      errorCode: 'RESOURCE_NOT_FOUND',
      status: HttpStatus.NOT_FOUND,
    });
  });

  it('actualiza la ficha y no pisa el ciclo si ya hay variedades', async () => {
    cultivo_repo.findOne.mockResolvedValue(
      cultivo_tomate({
        ciclo_productivo_cb: '68-75 días',
        variedades: [{ id_variedad: 12, fecha_baja: null }],
      }),
    );

    const result = await service.actualizar(
      45,
      { ...dto_tomate, descripcion_cb: 'Actualizado', ciclo_productivo_cb: '10 días' },
      ACTOR,
    );

    expect(result.message).toBe('Cultivo actualizado correctamente');
    expect(cultivo_repo.save).toHaveBeenCalledWith(
      expect.objectContaining({
        descripcion_cb: 'Actualizado',
        ciclo_productivo_cb: '68-75 días',
      }),
    );
  });

  it('da de baja lógica un cultivo sin uso', async () => {
    cultivo_repo.findOne.mockResolvedValue(cultivo_tomate());
    pcv_repo.find.mockResolvedValue([]);

    const result = await service.dar_baja(45, ACTOR);

    expect(result.message).toBe('Cultivo eliminado correctamente');
    expect(cultivo_repo.save).toHaveBeenCalledWith(
      expect.objectContaining({ fecha_baja_cb: expect.any(Date) }),
    );
  });

  it('no da de baja un cultivo asociado a una plantilla activa', async () => {
    cultivo_repo.findOne.mockResolvedValue(cultivo_tomate());
    pcv_repo.find.mockResolvedValue([
      { plantilla_base: { id_plantilla_base: 3, fecha_baja_pb: null } },
    ]);

    await expect(service.dar_baja(45, ACTOR)).rejects.toMatchObject({
      errorCode: 'RESOURCE_IN_USE',
      status: HttpStatus.CONFLICT,
    });
  });

  it('agrega una variedad y recalcula el ciclo productivo', async () => {
    cultivo_repo.findOne.mockResolvedValue(cultivo_tomate());
    variedad_repo.findOne.mockResolvedValue(null);
    variedad_repo.find.mockResolvedValue([
      { dias_a_cosecha: 75, fecha_baja: null },
    ]);

    const result = await service.agregar_variedad(
      45,
      {
        nombre_variedad: 'Perita',
        distancia_plantacion: '30x60cm',
        observaciones: 'Mas dulce, con menos semillas.',
        dias_a_cosecha: 75,
      },
      ACTOR,
    );

    expect(variedad_repo.create).toHaveBeenCalledWith(
      expect.objectContaining({
        nombre_variedad: 'Perita',
        cultivo_base: { id_cultivo_base: 45 },
      }),
    );
    expect(result.message).toBe('Variedad agregada correctamente');
    expect(result.id_variedad).toBe(12);
    expect(result.fecha_alta).toBe('2026-03-10');
    expect(result.en_uso).toBe(false);
    expect(result.ciclo_productivo_cb).toBe('75 días');
    expect(cultivo_repo.save).toHaveBeenCalledWith(
      expect.not.objectContaining({ variedades: expect.anything() }),
    );
  });

  it('recalcula el ciclo como rango cuando hay varias variedades', async () => {
    cultivo_repo.findOne.mockResolvedValue(cultivo_tomate());
    variedad_repo.findOne.mockResolvedValue(null);
    variedad_repo.find.mockResolvedValue([
      { dias_a_cosecha: 75, fecha_baja: null },
      { dias_a_cosecha: 68, fecha_baja: null },
    ]);

    const result = await service.agregar_variedad(
      45,
      {
        nombre_variedad: 'Redondo',
        distancia_plantacion: '40x70cm',
        dias_a_cosecha: 68,
      },
      ACTOR,
    );

    expect(result.ciclo_productivo_cb).toBe('68-75 días');
  });

  it('rechaza variedad duplicada dentro del mismo cultivo', async () => {
    cultivo_repo.findOne.mockResolvedValue(cultivo_tomate());
    variedad_repo.findOne.mockResolvedValue({
      id_variedad: 12,
      nombre_variedad: 'Perita',
    });

    await expect(
      service.agregar_variedad(
        45,
        {
          nombre_variedad: 'Perita',
          distancia_plantacion: '30x60cm',
          dias_a_cosecha: 75,
        },
        ACTOR,
      ),
    ).rejects.toMatchObject({
      errorCode: 'DUPLICATE_VALUE',
      status: HttpStatus.CONFLICT,
    });
  });

  it('no elimina una variedad en uso', async () => {
    cultivo_repo.findOne.mockResolvedValue(cultivo_tomate());
    variedad_repo.findOne.mockResolvedValue({
      id_variedad: 12,
      nombre_variedad: 'Perita',
      fecha_baja: null,
      cultivo_base: { id_cultivo_base: 45 },
    });
    pcv_repo.find.mockResolvedValue([
      { plantilla_base: { fecha_baja_pb: null } },
    ]);

    await expect(service.dar_baja_variedad(45, 12, ACTOR)).rejects.toMatchObject(
      {
        errorCode: 'RESOURCE_IN_USE',
        status: HttpStatus.CONFLICT,
      },
    );
  });

  it('da de baja lógica una variedad y recalcula el ciclo', async () => {
    cultivo_repo.findOne.mockResolvedValue(cultivo_tomate());
    variedad_repo.findOne.mockResolvedValue({
      id_variedad: 12,
      nombre_variedad: 'Perita',
      fecha_baja: null,
      cultivo_base: { id_cultivo_base: 45 },
    });
    pcv_repo.find.mockResolvedValue([]);
    variedad_repo.find.mockResolvedValue([
      { dias_a_cosecha: 68, fecha_baja: null },
    ]);

    const result = await service.dar_baja_variedad(45, 12, ACTOR);

    expect(result.message).toBe('Variedad eliminada correctamente');
    expect(result.ciclo_productivo_cb).toBe('68 días');
  });
});
