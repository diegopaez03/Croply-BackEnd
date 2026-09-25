import { HttpStatus } from '@nestjs/common';
import { EstadoPlanAccion } from '../../common/enums';
import { PlanesAccionService } from './planes-accion.service';

const ESTADO_PLANIFICADO = {
  id_estado_tarea: 1,
  nombre_estado_tarea: 'Planificado',
  protegido: true,
  es_estado_finalizador: false,
  cuenta_para_cierre_exitoso: false,
};
const ESTADO_COMPLETADO = {
  id_estado_tarea: 2,
  nombre_estado_tarea: 'Completado',
  protegido: true,
  es_estado_finalizador: true,
  cuenta_para_cierre_exitoso: true,
};
const ESTADO_CANCELADA = {
  id_estado_tarea: 3,
  nombre_estado_tarea: 'Cancelada',
  protegido: true,
  es_estado_finalizador: true,
  cuenta_para_cierre_exitoso: false,
};
const TIPO_SIEMBRA = {
  id_tipo_tarea: 2,
  nombre_tipo_tarea: 'Siembra',
  es_tipo_agroquimico: false,
};
const TIPO_AGRO = {
  id_tipo_tarea: 1,
  nombre_tipo_tarea: 'Aplicación de agroquímico',
  es_tipo_agroquimico: true,
};

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
  let agro_repo: ReturnType<typeof repo>;
  let cultivos_service: { detalle: jest.Mock };
  let plantillas_service: { detalle: jest.Mock };
  let tipos_tarea_service: { find_activo_by_id: jest.Mock };
  let estados_tarea_service: {
    estado_inicial: jest.Mock;
    estado_cancelada: jest.Mock;
    find_activo_by_id: jest.Mock;
  };
  let data_source: { transaction: jest.Mock };

  beforeEach(() => {
    plan_repo = repo();
    hito_repo = repo();
    tarea_repo = repo();
    parcela_repo = repo();
    cultivo_repo = repo();
    variedad_repo = repo();
    pcv_repo = repo();
    usuario_finca_repo = repo();
    agro_repo = repo();
    cultivos_service = { detalle: jest.fn() };
    plantillas_service = { detalle: jest.fn() };
    tipos_tarea_service = {
      find_activo_by_id: jest.fn(async (id_tipo_tarea: number) => {
        if (id_tipo_tarea === 1) return TIPO_AGRO;
        if (id_tipo_tarea === 2) return TIPO_SIEMBRA;
        return null;
      }),
    };
    estados_tarea_service = {
      estado_inicial: jest.fn().mockResolvedValue(ESTADO_PLANIFICADO),
      estado_cancelada: jest.fn().mockResolvedValue(ESTADO_CANCELADA),
      find_activo_by_id: jest.fn(async (id_estado_tarea: number) => {
        if (id_estado_tarea === 1) return ESTADO_PLANIFICADO;
        if (id_estado_tarea === 2) return ESTADO_COMPLETADO;
        if (id_estado_tarea === 3) return ESTADO_CANCELADA;
        return null;
      }),
    };

    data_source = {
      // Simula this.data_source.transaction(cb): ejecuta el callback
      // pasándole un "manager" falso con un update() que no hace nada real
      transaction: jest.fn(async (cb: (manager: unknown) => unknown) =>
        cb({ update: jest.fn().mockResolvedValue(undefined) }),
      ),
    };


    service = new PlanesAccionService(
      plan_repo as never,
      hito_repo as never,
      tarea_repo as never,
      parcela_repo as never,
      cultivo_repo as never,
      variedad_repo as never,
      pcv_repo as never,
      usuario_finca_repo as never,
      agro_repo as never,
      cultivos_service as never,
      plantillas_service as never,
      tipos_tarea_service as never,
      estados_tarea_service as never,
      data_source as never,
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
              descripcion_tp: 'Sembrar',
              nombre_producto: null,
              dosis_aa: null,
              tipo_tarea: TIPO_SIEMBRA,
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
        estado_tarea: ESTADO_PLANIFICADO,
        tipo_tarea: TIPO_SIEMBRA,
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
              tipo_tarea: TIPO_SIEMBRA,
              estado_tarea: ESTADO_PLANIFICADO,
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
              id_estado_tarea: 1,
              nombre_estado_tarea: 'Planificado',
              atrasada: true,
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
        id_tipo_tarea: 1,
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
      estado_tarea: ESTADO_COMPLETADO,
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
      estado_tarea: ESTADO_PLANIFICADO,
      tipo_tarea: TIPO_SIEMBRA,
      fecha_ejecucion_tarea: null,
      fecha_planificada_tarea: '2026-09-20',
      nombre_producto_aa: null,
      dosis_aa: null,
      responsable: null,
    };
    tarea_repo.findOne.mockResolvedValue(tarea);
    tarea_repo.find.mockResolvedValue([
      { estado_tarea: ESTADO_COMPLETADO },
    ]);

    const result = await service.cambiar_estado_tarea(77, 501, 2);

    expect(result.message).toBe('Estado de la tarea actualizado correctamente');
    expect(result.id_estado_tarea).toBe(2);
    expect(result.nombre_estado_tarea).toBe('Completado');
    expect(result.registro_agroquimico_generado).toBe(false);
    expect(result.todas_tareas_completadas).toBe(true);
    expect(result.fecha_ejecucion_tarea).toEqual(expect.any(String));
  });

  it('rechaza setear Inactivado o Finalizado con tareas pendientes', async () => {
    plan_repo.findOne.mockResolvedValue({
      id_plan_accion: 77,
      estado: EstadoPlanAccion.ACTIVO,
    });
    tarea_repo.find.mockResolvedValue([
      { estado_tarea: ESTADO_PLANIFICADO },
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

  it('no cierra con éxito un plan donde todas las tareas están canceladas', async () => {
    plan_repo.findOne.mockResolvedValue({
      id_plan_accion: 77,
      estado: EstadoPlanAccion.ACTIVO,
    });
    tarea_repo.find.mockResolvedValue([{ estado_tarea: ESTADO_CANCELADA }]);

    await expect(
      service.cambiar_estado_plan(77, EstadoPlanAccion.FINALIZADO),
    ).rejects.toMatchObject({ errorCode: 'TASKS_NOT_COMPLETED' });
  });

  it('genera el registro de agroquímico al completar ese tipo de tarea', async () => {
    plan_repo.findOne.mockResolvedValue({
      id_plan_accion: 77,
      estado: EstadoPlanAccion.ACTIVO,
      parcela: { finca: { id_finca: 12 } },
    });
    const tarea = {
      id_tarea: 501,
      estado_tarea: ESTADO_PLANIFICADO,
      tipo_tarea: TIPO_AGRO,
      fecha_ejecucion_tarea: null,
      fecha_planificada_tarea: '2026-09-20',
      nombre_producto_aa: 'Fungicida XYZ',
      dosis_aa: '2 L/ha',
      fecha_hora_aplicacion_aa: new Date('2026-09-20T09:00:00Z'),
      responsable: null,
    };
    tarea_repo.findOne.mockResolvedValue(tarea);
    tarea_repo.find.mockResolvedValue([{ estado_tarea: ESTADO_COMPLETADO }]);
    agro_repo.findOne.mockResolvedValue(null);

    const result = await service.cambiar_estado_tarea(77, 501, 2);

    expect(result.registro_agroquimico_generado).toBe(true);
    expect(agro_repo.save).toHaveBeenCalled();
  });

  it('no duplica el registro de agroquímico si ya existía', async () => {
    plan_repo.findOne.mockResolvedValue({
      id_plan_accion: 77,
      estado: EstadoPlanAccion.ACTIVO,
      parcela: { finca: { id_finca: 12 } },
    });
    tarea_repo.findOne.mockResolvedValue({
      id_tarea: 501,
      estado_tarea: ESTADO_PLANIFICADO,
      tipo_tarea: TIPO_AGRO,
      fecha_planificada_tarea: '2026-09-20',
      nombre_producto_aa: 'Fungicida XYZ',
      dosis_aa: '2 L/ha',
      fecha_hora_aplicacion_aa: new Date('2026-09-20T09:00:00Z'),
      responsable: null,
    });
    tarea_repo.find.mockResolvedValue([{ estado_tarea: ESTADO_COMPLETADO }]);
    agro_repo.findOne.mockResolvedValue({ id_aplicacion_agroquimico: 9 });

    const result = await service.cambiar_estado_tarea(77, 501, 2);

    expect(result.registro_agroquimico_generado).toBe(false);
    expect(result.message).toBe(
      'Ya existe un registro de agroquímico asociado a esta tarea. No se generó un nuevo registro.',
    );
    expect(agro_repo.save).not.toHaveBeenCalled();
  });

  it('reprograma la fecha y recalcula atrasada', async () => {
    plan_repo.findOne.mockResolvedValue({
      id_plan_accion: 77,
      estado: EstadoPlanAccion.ACTIVO,
    });
    const tarea = {
      id_tarea: 501,
      estado_tarea: ESTADO_PLANIFICADO,
      fecha_planificada_tarea: '2026-09-01',
    };
    tarea_repo.findOne.mockResolvedValue(tarea);

    const result = await service.reprogramar_tarea(77, 501, '2099-01-01');

    expect(result).toEqual({
      message: 'Fecha reprogramada correctamente',
      id_tarea: 501,
      fecha_planificada_tarea: '2099-01-01',
      atrasada: false,
    });
  });

  it('filtra tareas del cronograma por estado y fecha', async () => {
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
              nombre_tarea: 'Una',
              descripcion_tarea: 'Una',
              fecha_planificada_tarea: '2026-09-15',
              fecha_ejecucion_tarea: null,
              fecha_creacion_tarea: new Date('2026-09-10T10:00:00Z'),
              tipo_tarea: TIPO_SIEMBRA,
              estado_tarea: ESTADO_PLANIFICADO,
              responsable: null,
            },
            {
              id_tarea: 502,
              nombre_tarea: 'Otra',
              descripcion_tarea: 'Otra',
              fecha_planificada_tarea: '2026-09-22',
              fecha_ejecucion_tarea: null,
              fecha_creacion_tarea: new Date('2026-09-10T10:00:00Z'),
              tipo_tarea: TIPO_SIEMBRA,
              estado_tarea: ESTADO_COMPLETADO,
              responsable: null,
            },
          ],
        },
      ],
    });

    const result = await service.detalle(77, {
      estado: 2,
      fecha: '2026-09-22',
    });

    expect(result.hitos[0].tareas).toEqual([
      expect.objectContaining({ id_tarea: 502, atrasada: false }),
    ]);
  });

  it('cancela tareas no finalizadas e inactiva el plan activo de la parcela', async () => {
    const pendiente = {
      id_tarea: 501,
      estado_tarea: ESTADO_PLANIFICADO,
    };
    const hecha = {
      id_tarea: 502,
      estado_tarea: ESTADO_COMPLETADO,
    };
    const plan = {
      id_plan_accion: 77,
      estado: EstadoPlanAccion.ACTIVO,
      fecha_fin_pa: null,
      hitos: [{ tareas: [pendiente, hecha] }],
    };
    plan_repo.find.mockResolvedValue([plan]);

    await service.cancelar_pendientes_y_inactivar_planes({ id_parcela: 101 });

    expect(pendiente.estado_tarea).toBe(ESTADO_CANCELADA);
    expect(hecha.estado_tarea).toBe(ESTADO_COMPLETADO);
    expect(plan.estado).toBe(EstadoPlanAccion.INACTIVADO);
    expect(plan.fecha_fin_pa).toEqual(expect.any(String));
  });
});
