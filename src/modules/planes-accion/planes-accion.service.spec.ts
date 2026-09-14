import { HttpStatus } from '@nestjs/common';
import { EstadoPlanAccion, EstadoTarea } from '../../common/enums';
import { PlanesAccionService } from './planes-accion.service';

function repo() {
  return {
    findOne: jest.fn(),
    find: jest.fn().mockResolvedValue([]),
    create: jest.fn((value) => value),
    save: jest.fn(async (value) => value),
    remove: jest.fn(async (value) => value),
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
  let usuario_finca_repo: ReturnType<typeof repo>;
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
    usuario_finca_repo = repo();
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
      usuario_finca_repo as never,
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
        nombre_tarea: 'Siembra',
        descripcion_tarea: 'Sembrar',
        dia_relativo_tarea: 0,
        fecha_planificada_tarea: '2026-09-15',
        estado: EstadoTarea.PLANIFICADO,
        nombre_producto_aa: null,
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

  it('devuelve el cronograma del plan con hitos y tareas', async () => {
    plan_repo.findOne.mockResolvedValue({
      id_plan_accion: 77,
      fecha_inicio_pa: '2026-09-15',
      fecha_fin_pa: null,
      superficie_ocupada_pa: 12.5,
      estado: EstadoPlanAccion.ACTIVO,
      hitos: [
        {
          id_hito: 201,
          nombre_hito: 'Siembra',
          orden_hito: 1,
          tareas: [
            {
              id_tarea: 501,
              nombre_tarea: 'Preparación de almácigo',
              descripcion_tarea: 'Preparación de almácigo en sector norte',
              fecha_planificada_tarea: '2026-09-15',
              fecha_ejecucion_tarea: null,
              fecha_creacion_tarea: new Date('2026-09-10T10:00:00Z'),
              id_tipo_tarea: 2,
              estado: EstadoTarea.PLANIFICADO,
              nombre_producto_aa: null,
              dosis_aa: null,
              fecha_hora_aplicacion_aa: null,
              responsable: null,
            },
          ],
        },
      ],
    });

    await expect(service.detalle(77)).resolves.toEqual({
      id_plan_accion: 77,
      fecha_inicio_pa: '2026-09-15',
      fecha_fin_pa: null,
      superficie_ocupada_pa: 12.5,
      estado: EstadoPlanAccion.ACTIVO,
      hitos: [
        {
          id_hito_real: 201,
          nombre_hito: 'Siembra',
          orden_hito: 1,
          tareas: [
            expect.objectContaining({
              id_tarea: 501,
              nombre_tarea: 'Preparación de almácigo',
              id_tipo_tarea: 2,
              nombre_tipo_tarea: 'Siembra',
              estado: EstadoTarea.PLANIFICADO,
              id_responsable: null,
              nombre_producto_aa: null,
            }),
          ],
        },
      ],
    });
  });

  it('exige los campos de agroquímico al crear una tarea de ese tipo', async () => {
    plan_repo.findOne.mockResolvedValue({
      id_plan_accion: 77,
      estado: EstadoPlanAccion.ACTIVO,
      parcela: { finca: { id_finca: 12 } },
    });
    hito_repo.findOne.mockResolvedValue({ id_hito: 201 });

    await expect(
      service.crear_tarea(77, 201, {
        nombre_tarea: 'Fungicida',
        descripcion_tarea: 'Aplicación foliar',
        fecha_planificada_tarea: '2026-09-20',
        id_tipo_tarea: 5,
      }),
    ).rejects.toMatchObject({
      errorCode: 'REQUIRED_FIELD',
      field: 'nombre_producto_aa',
    });
  });

  it('rechaza editar o eliminar una tarea completada', async () => {
    plan_repo.findOne.mockResolvedValue({
      id_plan_accion: 77,
      estado: EstadoPlanAccion.ACTIVO,
      parcela: { finca: { id_finca: 12 } },
    });
    tarea_repo.findOne.mockResolvedValue({
      id_tarea: 501,
      estado: EstadoTarea.COMPLETADO,
    });

    await expect(
      service.editar_tarea(77, 501, {
        nombre_tarea: 'Otra',
        descripcion_tarea: 'Otra',
        fecha_planificada_tarea: '2026-09-21',
        id_tipo_tarea: 2,
      }),
    ).rejects.toMatchObject({ errorCode: 'TASK_NOT_EDITABLE', status: 409 });

    await expect(service.eliminar_tarea(77, 501)).rejects.toMatchObject({
      errorCode: 'TASK_NOT_EDITABLE',
    });
  });

  it('marca ejecución y avisa si el plan quedó completo', async () => {
    plan_repo.findOne.mockResolvedValue({
      id_plan_accion: 77,
      estado: EstadoPlanAccion.ACTIVO,
      parcela: { finca: { id_finca: 12 } },
    });
    const tarea = {
      id_tarea: 501,
      estado: EstadoTarea.PLANIFICADO,
      fecha_ejecucion_tarea: null,
    };
    tarea_repo.findOne.mockResolvedValue(tarea);
    tarea_repo.find.mockResolvedValue([
      { estado: EstadoTarea.COMPLETADO },
    ]);

    const result = await service.cambiar_estado_tarea(
      77,
      501,
      EstadoTarea.COMPLETADO,
    );

    expect(result.message).toBe('Estado de la tarea actualizado correctamente');
    expect(result.estado).toBe(EstadoTarea.COMPLETADO);
    expect(result.todas_tareas_completadas).toBe(true);
    expect(result.fecha_ejecucion_tarea).toEqual(expect.any(String));
  });

  it('rechaza setear Inactivado o Finalizado con tareas pendientes', async () => {
    plan_repo.findOne.mockResolvedValue({
      id_plan_accion: 77,
      estado: EstadoPlanAccion.ACTIVO,
    });
    tarea_repo.find.mockResolvedValue([
      { estado: EstadoTarea.PLANIFICADO },
    ]);

    await expect(
      service.cambiar_estado_plan(77, EstadoPlanAccion.INACTIVADO),
    ).rejects.toMatchObject({ errorCode: 'INVALID_STATUS_TRANSITION' });

    await expect(
      service.cambiar_estado_plan(77, EstadoPlanAccion.FINALIZADO),
    ).rejects.toMatchObject({ errorCode: 'TASKS_NOT_COMPLETED' });
  });

  it('permite cancelar el plan sin completar las tareas', async () => {
    const plan = {
      id_plan_accion: 77,
      estado: EstadoPlanAccion.ACTIVO,
      fecha_fin_pa: null,
    };
    plan_repo.findOne.mockResolvedValue(plan);

    await expect(
      service.cambiar_estado_plan(77, EstadoPlanAccion.CANCELADO),
    ).resolves.toEqual({
      message: 'Estado del plan de acción actualizado correctamente',
    });
    expect(plan.estado).toBe(EstadoPlanAccion.CANCELADO);
    expect(plan.fecha_fin_pa).toEqual(expect.any(String));
  });
});
