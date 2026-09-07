import { HttpStatus } from '@nestjs/common';
import { EstadoPlanAccion } from '../../common/enums';
import { PlanesAccionService } from './planes-accion.service';

function repo() {
  return {
    findOne: jest.fn(),
    find: jest.fn().mockResolvedValue([]),
    create: jest.fn((value) => value),
    save: jest.fn(async (value) => value),
  };
}

describe('PlanesAccionService', () => {
  let service: PlanesAccionService;
  let plan_repo: ReturnType<typeof repo>;
  let hito_repo: ReturnType<typeof repo>;
  let tarea_repo: ReturnType<typeof repo>;
  let parcela_repo: ReturnType<typeof repo>;
  let cultivo_repo: ReturnType<typeof repo>;
  let variedad_repo: ReturnType<typeof repo>;
  let pcv_repo: ReturnType<typeof repo>;
  let cultivos_service: { detalle: jest.Mock };
  let plantillas_service: { detalle: jest.Mock };

  beforeEach(() => {
    plan_repo = repo();
    hito_repo = repo();
    tarea_repo = repo();
    parcela_repo = repo();
    cultivo_repo = repo();
    variedad_repo = repo();
    pcv_repo = repo();
    cultivos_service = { detalle: jest.fn() };
    plantillas_service = { detalle: jest.fn() };
    service = new PlanesAccionService(
      plan_repo as never,
      hito_repo as never,
      tarea_repo as never,
      parcela_repo as never,
      cultivo_repo as never,
      variedad_repo as never,
      pcv_repo as never,
      cultivos_service as never,
      plantillas_service as never,
    );
  });

  it('rechaza la suma de asignaciones que excede la superficie disponible', async () => {
    parcela_repo.findOne.mockResolvedValue({
      id_parcela: 101,
      superficie_parcela: 8,
      finca: { id_finca: 12 },
    });
    cultivo_repo.findOne.mockResolvedValue({ id_cultivo_base: 45 });

    await expect(
      service.crear(101, {
        id_cultivo_base: 45,
        asignaciones: [
          { id_variedad: 12, superficie_asignada: 5, fecha_inicio: '2026-09-15' },
          { id_variedad: 13, superficie_asignada: 4, fecha_inicio: '2026-09-15' },
        ],
      }),
    ).rejects.toMatchObject({
      errorCode: 'INSUFFICIENT_AREA',
      field: 'superficie_asignada',
      status: HttpStatus.BAD_REQUEST,
    });
  });

  it('crea un plan independiente y copia hitos y tareas de la plantilla', async () => {
    const parcela = {
      id_parcela: 101,
      superficie_parcela: 8,
      finca: { id_finca: 12 },
    };
    const cultivo = { id_cultivo_base: 45, nombre_cultivo_base: 'Tomate' };
    const variedad = {
      id_variedad: 12,
      nombre_variedad: 'Perita',
      cultivo_base: cultivo,
    };
    const plantilla = {
      id_plantilla_base: 3,
      fecha_baja_pb: null,
      hitos: [
        {
          nombre_hpb: 'Siembra',
          orden_hpb: 1,
          tareas: [
            {
              dia_relativo_tp: 0,
              id_tipo_tarea: 2,
              descripcion_tp: 'Sembrar',
              nombre_producto: null,
              dosis_aa: null,
            },
          ],
        },
      ],
    };
    parcela_repo.findOne.mockResolvedValue(parcela);
    cultivo_repo.findOne.mockResolvedValue(cultivo);
    variedad_repo.findOne.mockResolvedValue(variedad);
    pcv_repo.find.mockResolvedValue([
      { plantilla_base: plantilla, variedad },
    ]);
    plan_repo.save.mockResolvedValue({ id_plan_accion: 88 });
    hito_repo.save.mockResolvedValue({ id_hito: 10 });

    const result = await service.crear(101, {
      id_cultivo_base: 45,
      asignaciones: [
        { id_variedad: 12, superficie_asignada: 5, fecha_inicio: '2026-09-15' },
      ],
    });

    expect(result).toEqual({
      message: 'Cultivo y plan de acción asignados correctamente',
      ids_plan_accion: [88],
    });
    expect(plan_repo.create).toHaveBeenCalledWith(
      expect.objectContaining({
        estado: EstadoPlanAccion.ACTIVO,
        superficie_ocupada_pa: 5,
        fecha_inicio_pa: '2026-09-15',
      }),
    );
    expect(hito_repo.create).toHaveBeenCalledWith(
      expect.objectContaining({ nombre_hito: 'Siembra', orden_hito: 1 }),
    );
    expect(tarea_repo.create).toHaveBeenCalledWith(
      expect.objectContaining({
        descripcion_tarea: 'Sembrar',
        dia_relativo_tarea: 0,
      }),
    );
  });

  it('previsualiza la superficie y el cronograma sin guardar', async () => {
    cultivos_service.detalle.mockResolvedValue({
      id_cultivo_base: 45,
      variedades: [{ id_variedad: 12, nombre_variedad: 'Perita' }],
    });
    parcela_repo.findOne.mockResolvedValue({
      id_parcela: 101,
      superficie_parcela: 8,
      finca: { id_finca: 12 },
    });
    const plantilla = {
      id_plantilla_base: 3,
      fecha_baja_pb: null,
      hitos: [],
    };
    pcv_repo.find.mockResolvedValue([
      { plantilla_base: plantilla, variedad: null },
    ]);
    plantillas_service.detalle.mockResolvedValue({
      hitos: [
        {
          nombre_hpb: 'Siembra',
          orden_hpb: 1,
          tareas: [{ descripcion_tp: 'Sembrar', dia_relativo_tp: 0 }],
        },
      ],
    });

    const result = await service.plan_preview(45, 101);

    expect(result.superficie_disponible_parcela).toBe(8);
    expect(result.plantillas[0].variedades).toEqual([
      { id_variedad: 12, nombre_variedad: 'Perita' },
    ]);
    expect(plan_repo.save).not.toHaveBeenCalled();
  });

  it('devuelve el historial ordenado por fecha de inicio descendente', async () => {
    parcela_repo.findOne.mockResolvedValue({
      id_parcela: 101,
      superficie_parcela: 8,
      finca: { id_finca: 12 },
    });
    plan_repo.find.mockResolvedValue([
      {
        id_plan_accion: 60,
        cultivo_base: { nombre_cultivo_base: 'Ajo' },
        variedad: { nombre_variedad: 'Morado' },
        superficie_ocupada_pa: 4.2,
        fecha_inicio_pa: '2025-04-01',
        fecha_fin_pa: '2025-08-15',
        estado: 'Finalizado',
      },
    ]);

    const result = await service.historial_cultivos(101);

    expect(result).toEqual({
      historial: [
        {
          id_plan_accion: 60,
          nombre_cultivo_base: 'Ajo',
          nombre_variedad: 'Morado',
          superficie_ocupada_pa: 4.2,
          fecha_inicio_pa: '2025-04-01',
          fecha_fin_pa: '2025-08-15',
          estado: 'Finalizado',
        },
      ],
    });
    expect(plan_repo.find).toHaveBeenCalledWith(
      expect.objectContaining({ order: { fecha_inicio_pa: 'DESC' } }),
    );
  });
});
