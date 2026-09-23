import { HttpStatus, Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { DataSource, In, IsNull, Not, Repository } from 'typeorm';
import { EstadoPlanAccion } from '../../common/enums';
import {
  DomainException,
  invalidStatusTransition,
  requiredField,
  resourceNotFound,
  taskNotEditable,
  tasksNotCompleted,
} from '../../common/exceptions';
import { CultivosBaseService } from '../cultivos/cultivos-base.service';
import { PlantillasBaseService } from '../cultivos/plantillas-base.service';
import { CultivoBase } from '../cultivos/entities/cultivo-base.entity';
import { PlantillaBase } from '../cultivos/entities/plantilla-base.entity';
import { PlantillaCultivoVariedad } from '../cultivos/entities/plantilla-cultivo-variedad.entity';
import { Variedad } from '../cultivos/entities/variedad.entity';
import { EstadosTareaService } from '../estados-tarea';
import { EstadoTarea } from '../estados-tarea/entities/estado-tarea.entity';
import { UsuarioFinca } from '../fincas/entities/usuario-finca.entity';
import { Parcela } from '../parcelas/entities/parcela.entity';
import { TiposTareaService } from '../tipos-tarea';
import { CrearPlanAccionDto } from './dto/planes-accion.dto';
import { CrearTareaPlanDto, CronogramaQueryDto } from './dto/tareas-plan.dto';
import { AplicacionAgroquimico } from './entities/aplicacion-agroquimico.entity';
import { Hito } from './entities/hito.entity';
import { PlanAccion } from './entities/plan-accion.entity';
import { Tarea } from './entities/tarea.entity';

const ESTADOS_PLAN_MANUALES = [
  EstadoPlanAccion.FINALIZADO,
  EstadoPlanAccion.CANCELADO,
  EstadoPlanAccion.FINALIZADO_POR_CONTINGENCIA,
] as const;

@Injectable()
export class PlanesAccionService {
  constructor(
    @InjectRepository(PlanAccion)
    private readonly plan_repo: Repository<PlanAccion>,
    @InjectRepository(Hito)
    private readonly hito_repo: Repository<Hito>,
    @InjectRepository(Tarea)
    private readonly tarea_repo: Repository<Tarea>,
    @InjectRepository(Parcela)
    private readonly parcela_repo: Repository<Parcela>,
    @InjectRepository(CultivoBase)
    private readonly cultivo_repo: Repository<CultivoBase>,
    @InjectRepository(Variedad)
    private readonly variedad_repo: Repository<Variedad>,
    @InjectRepository(PlantillaCultivoVariedad)
    private readonly pcv_repo: Repository<PlantillaCultivoVariedad>,
    @InjectRepository(UsuarioFinca)
    private readonly usuario_finca_repo: Repository<UsuarioFinca>,
    @InjectRepository(AplicacionAgroquimico)
    private readonly agro_repo: Repository<AplicacionAgroquimico>,
    private readonly cultivos_service: CultivosBaseService,
    private readonly plantillas_service: PlantillasBaseService,
    private readonly tipos_tarea_service: TiposTareaService,
    private readonly estados_tarea_service: EstadosTareaService,
    private readonly data_source: DataSource,
  ) {}

  async plan_preview(id_cultivo_base: number, id_parcela: number) {
    const cultivo = await this.cultivos_service.detalle(id_cultivo_base);
    const parcela = await this.require_parcela(id_parcela);
    const plantillas = await this.find_plantillas_del_cultivo(id_cultivo_base);
    const superficie_disponible_parcela = await this.superficie_disponible(parcela);

    const grouped = new Map<number, {
      plantilla: PlantillaBase;
      variedades: Array<{ id_variedad: number; nombre_variedad: string }>;
    }>();
    for (const pcv of plantillas) {
      const id_plantilla = Number(pcv.plantilla_base.id_plantilla_base);
      const actual = grouped.get(id_plantilla) ?? {
        plantilla: pcv.plantilla_base,
        variedades: [],
      };
      if (pcv.variedad) {
        actual.variedades.push({
          id_variedad: Number(pcv.variedad.id_variedad),
          nombre_variedad: pcv.variedad.nombre_variedad,
        });
      } else {
        actual.variedades = cultivo.variedades.map((variedad) => ({
          id_variedad: variedad.id_variedad,
          nombre_variedad: variedad.nombre_variedad,
        }));
      }
      grouped.set(id_plantilla, actual);
    }

    const result = [];
    for (const item of grouped.values()) {
      const detalle = await this.plantillas_service.detalle(
        Number(item.plantilla.id_plantilla_base),
      );
      result.push({
        id_plantilla_base: Number(item.plantilla.id_plantilla_base),
        variedades: item.variedades,
        hitos: detalle.hitos.map((hito) => ({
          id_hito_plantilla: Number(hito.id_hito_plantilla), 
          nombre_hpb: hito.nombre_hpb,
          orden_hpb: hito.orden_hpb,
          tareas: hito.tareas.map((tarea) => ({
            id_tarea_plantilla: Number(tarea.id_tarea_plantilla),
            descripcion_tp: tarea.descripcion_tp,
            dia_relativo_tp: tarea.dia_relativo_tp,
          })),
        })),
      });
    }

    return { superficie_disponible_parcela, plantillas: result };
  }

  async crear(id_parcela: number, dto: CrearPlanAccionDto) {
    const parcela = await this.require_parcela(id_parcela);
    const cultivo = await this.cultivo_repo.findOne({
      where: { id_cultivo_base: dto.id_cultivo_base, fecha_baja_cb: IsNull() },
    });
    if (!cultivo) {
      throw resourceNotFound();
    }

    const superficie_disponible_parcela = await this.superficie_disponible(parcela);
    const total_solicitado = dto.asignaciones.reduce(
      (total, asignacion) => total + asignacion.superficie_asignada,
      0,
    );
    if (
      dto.asignaciones.some(
        (asignacion) => asignacion.superficie_asignada > superficie_disponible_parcela,
      ) ||
      total_solicitado > superficie_disponible_parcela
    ) {
      throw new DomainException(
        'INSUFFICIENT_AREA',
        'La superficie ingresada excede la superficie disponible en la parcela.',
        HttpStatus.BAD_REQUEST,
        'superficie_asignada',
      );
    }

    const ids_plan_accion: number[] = [];
    const estado_inicial = await this.estados_tarea_service.estado_inicial();
    for (const asignacion of dto.asignaciones) {
      const variedad = await this.variedad_repo.findOne({
        where: {
          id_variedad: asignacion.id_variedad,
          fecha_baja: IsNull(),
          cultivo_base: { id_cultivo_base: dto.id_cultivo_base },
        },
        relations: ['cultivo_base'],
      });
      if (!variedad) {
        throw resourceNotFound();
      }

      const plantilla = await this.find_plantilla_para_variedad(
        dto.id_cultivo_base,
        asignacion.id_variedad,
      );
      if (!plantilla) {
        throw resourceNotFound();
      }

      const plan = await this.plan_repo.save(
        this.plan_repo.create({
          parcela,
          cultivo_base: cultivo,
          variedad,
          superficie_ocupada_pa: asignacion.superficie_asignada,
          fecha_inicio_pa: asignacion.fecha_inicio,
          fecha_fin_pa: null,
          estado: EstadoPlanAccion.ACTIVO,
        }),
      );
      for (const hito_plantilla of plantilla.hitos ?? []) {
        const hito = await this.hito_repo.save(
          this.hito_repo.create({
            nombre_hito: hito_plantilla.nombre_hpb,
            orden_hito: hito_plantilla.orden_hpb,
            plan_accion: plan,
          }),
        );
        for (const tarea_plantilla of hito_plantilla.tareas ?? []) {
          const tipo = tarea_plantilla.tipo_tarea;
          if (!tipo) {
            throw resourceNotFound('El tipo de tarea indicado no existe.');
          }
          await this.tarea_repo.save(
            this.tarea_repo.create({
              nombre_tarea: tipo.nombre_tipo_tarea,
              descripcion_tarea: tarea_plantilla.descripcion_tp,
              fecha_planificada_tarea: add_days_iso(
                asignacion.fecha_inicio,
                tarea_plantilla.dia_relativo_tp,
              ),
              fecha_ejecucion_tarea: null,
              tipo_tarea: tipo,
              estado_tarea: estado_inicial,
              nombre_producto_aa: tarea_plantilla.nombre_producto,
              dosis_aa: tarea_plantilla.dosis_aa,
              fecha_hora_aplicacion_aa: null,
              dia_relativo_tarea: tarea_plantilla.dia_relativo_tp,
              responsable: null,
              hito,
            }),
          );
        }
      }
      ids_plan_accion.push(Number(plan.id_plan_accion));
    }

    return {
      message: 'Cultivo y plan de acción asignados correctamente',
      ids_plan_accion,
    };
  }

  async historial_cultivos(id_parcela: number) {
    await this.require_parcela(id_parcela);
    const planes = await this.plan_repo.find({
      where: {
        parcela: { id_parcela },
        estado: Not(EstadoPlanAccion.ACTIVO),
      },
      relations: ['cultivo_base', 'variedad'],
      order: { fecha_inicio_pa: 'DESC' },
    });

    return {
      historial: planes.map((plan) => ({
        id_plan_accion: Number(plan.id_plan_accion),
        nombre_cultivo_base: plan.cultivo_base.nombre_cultivo_base,
        nombre_variedad: plan.variedad.nombre_variedad,
        superficie_ocupada_pa: plan.superficie_ocupada_pa,
        fecha_inicio_pa: plan.fecha_inicio_pa,
        fecha_fin_pa: plan.fecha_fin_pa,
        estado: plan.estado,
      })),
    };
  }

  async detalle(id_plan_accion: number, filtros: CronogramaQueryDto = {}) {
    const plan = await this.require_plan(id_plan_accion, [
      'hitos',
      'hitos.tareas',
      'hitos.tareas.tipo_tarea',
      'hitos.tareas.estado_tarea',
      'hitos.tareas.responsable',
      'hitos.tareas.responsable.usuario',
    ]);
    const hitos = [...(plan.hitos ?? [])].sort(
      (a, b) => a.orden_hito - b.orden_hito,
    );
    const fecha = filtros.fecha ? to_date_only(filtros.fecha) : null;

    return {
      id_plan_accion: Number(plan.id_plan_accion),
      fecha_inicio_pa: to_date_only(plan.fecha_inicio_pa),
      fecha_fin_pa: plan.fecha_fin_pa ? to_date_only(plan.fecha_fin_pa) : null,
      superficie_ocupada_pa: Number(plan.superficie_ocupada_pa),
      estado: plan.estado,
      hitos: hitos.map((hito) => ({
        id_hito_real: Number(hito.id_hito),
        nombre_hito: hito.nombre_hito,
        orden_hito: hito.orden_hito,
        tareas: [...(hito.tareas ?? [])]
          .sort((a, b) =>
            a.fecha_planificada_tarea.localeCompare(b.fecha_planificada_tarea),
          )
          .map((tarea) => this.to_tarea_response(tarea))
          .filter((tarea) => {
            if (
              filtros.estado != null &&
              tarea.id_estado_tarea !== Number(filtros.estado)
            ) {
              return false;
            }
            if (fecha && tarea.fecha_planificada_tarea !== fecha) {
              return false;
            }
            return true;
          }),
      })),
    };
  }

  async crear_tarea(
    id_plan_accion: number,
    id_hito_real: number,
    dto: CrearTareaPlanDto,
  ) {
    const plan = await this.require_plan_activo(id_plan_accion);
    const hito = await this.hito_repo.findOne({
      where: {
        id_hito: id_hito_real,
        plan_accion: { id_plan_accion },
      },
    });
    if (!hito) {
      throw resourceNotFound();
    }

    const payload = await this.build_tarea_payload(plan, dto);
    const estado_inicial = await this.estados_tarea_service.estado_inicial();
    const saved = await this.tarea_repo.save(
      this.tarea_repo.create({
        ...payload,
        estado_tarea: estado_inicial,
        fecha_ejecucion_tarea: null,
        hito,
      }),
    );

    return {
      message: 'Tarea agregada correctamente',
      ...this.to_tarea_response(await this.require_tarea(id_plan_accion, Number(saved.id_tarea))),
    };
  }

  async editar_tarea(
    id_plan_accion: number,
    id_tarea: number,
    dto: CrearTareaPlanDto,
  ) {
    await this.require_plan_activo(id_plan_accion);
    const tarea = await this.require_tarea_editable(id_plan_accion, id_tarea);
    const plan = await this.require_plan(id_plan_accion, ['parcela', 'parcela.finca']);
    const payload = await this.build_tarea_payload(plan, dto);

    Object.assign(tarea, payload);
    await this.tarea_repo.save(tarea);

    return this.to_tarea_response(
      await this.require_tarea(id_plan_accion, id_tarea),
    );
  }

  async cambiar_estado_tarea(
    id_plan_accion: number,
    id_tarea: number,
    id_estado_tarea: number,
  ) {
    await this.require_plan_activo(id_plan_accion);
    const tarea = await this.require_tarea_editable(id_plan_accion, id_tarea);
    const estado =
      await this.estados_tarea_service.find_activo_by_id(id_estado_tarea);
    if (!estado) {
      throw resourceNotFound();
    }

    tarea.estado_tarea = estado;
    tarea.fecha_ejecucion_tarea = estado.cuenta_para_cierre_exitoso
      ? new Date()
      : null;
    await this.tarea_repo.save(tarea);

    const { message, registro_agroquimico_generado } =
      await this.registrar_agroquimico_si_corresponde(tarea, estado);

    return {
      message,
      id_tarea: Number(tarea.id_tarea),
      id_estado_tarea: Number(estado.id_estado_tarea),
      nombre_estado_tarea: estado.nombre_estado_tarea,
      fecha_ejecucion_tarea: to_iso(tarea.fecha_ejecucion_tarea),
      todas_tareas_completadas:
        await this.todas_tareas_completadas(id_plan_accion),
      registro_agroquimico_generado,
    };
  }

  async reprogramar_tarea(
    id_plan_accion: number,
    id_tarea: number,
    fecha_planificada_tarea: string,
  ) {
    await this.require_plan_activo(id_plan_accion);
    const tarea = await this.require_tarea_editable(id_plan_accion, id_tarea);
    tarea.fecha_planificada_tarea = to_date_only(fecha_planificada_tarea);
    await this.tarea_repo.save(tarea);

    return {
      message: 'Fecha reprogramada correctamente',
      id_tarea: Number(tarea.id_tarea),
      fecha_planificada_tarea: to_date_only(tarea.fecha_planificada_tarea),
      atrasada: this.calcular_atrasada(tarea),
    };
  }

async cancelar_pendientes_y_inactivar_planes(filtro: {
  id_parcela?: number;
  id_finca?: number;
}): Promise<void> {
  const where = filtro.id_parcela
    ? {
        parcela: { id_parcela: filtro.id_parcela },
        estado: EstadoPlanAccion.ACTIVO,
      }
    : {
        parcela: { finca: { id_finca: filtro.id_finca } },
        estado: EstadoPlanAccion.ACTIVO,
      };
  const planes = await this.plan_repo.find({
    where,
    relations: ['hitos', 'hitos.tareas', 'hitos.tareas.estado_tarea'],
  });
  if (planes.length === 0) {
    return;
  }

  const cancelada = await this.estados_tarea_service.estado_cancelada();
  const fecha_fin = today_iso();

  // Recolectamos los ids en memoria (sin tocar la base todavía)
  const ids_tareas_a_cancelar: number[] = [];
  for (const plan of planes) {
    for (const hito of plan.hitos ?? []) {
      for (const tarea of hito.tareas ?? []) {
        if (!tarea.estado_tarea?.es_estado_finalizador) {
          ids_tareas_a_cancelar.push(tarea.id_tarea);
        }
      }
    }
  }
  const ids_planes = planes.map((plan) => plan.id_plan_accion);

  //NUEVO: todo dentro de una transacción, con updates masivos (no un save por fila)
  await this.data_source.transaction(async (manager) => {
    if (ids_tareas_a_cancelar.length > 0) {
      await manager.update(
        Tarea,
        { id_tarea: In(ids_tareas_a_cancelar) },
        { estado_tarea: cancelada },
      );
    }

    await manager.update(
      PlanAccion,
      { id_plan_accion: In(ids_planes) },
      { estado: EstadoPlanAccion.INACTIVADO, fecha_fin_pa: fecha_fin },
    );
  });
}

  async eliminar_tarea(id_plan_accion: number, id_tarea: number) {
    await this.require_plan_activo(id_plan_accion);
    const tarea = await this.require_tarea_editable(id_plan_accion, id_tarea);
    await this.tarea_repo.remove(tarea);
    return { message: 'Tarea eliminada correctamente' };
  }

  async cambiar_estado_plan(
    id_plan_accion: number,
    estado: EstadoPlanAccion,
  ) {
    const plan = await this.require_plan(id_plan_accion);

    if (estado === EstadoPlanAccion.INACTIVADO) {
      throw invalidStatusTransition(
        'El estado Inactivado no se puede asignar manualmente.',
      );
    }
    if (
      !ESTADOS_PLAN_MANUALES.includes(
        estado as (typeof ESTADOS_PLAN_MANUALES)[number],
      )
    ) {
      throw invalidStatusTransition();
    }
    if (plan.estado !== EstadoPlanAccion.ACTIVO) {
      throw invalidStatusTransition(
        'Solo se puede cambiar el estado de un plan activo.',
      );
    }
    if (estado === EstadoPlanAccion.FINALIZADO) {
      const completadas = await this.todas_tareas_completadas(id_plan_accion);
      if (!completadas) {
        throw tasksNotCompleted();
      }
    }

    plan.estado = estado;
    plan.fecha_fin_pa = today_iso();
    await this.plan_repo.save(plan);

    return { message: 'Estado del plan de acción actualizado correctamente' };
  }

  private async require_parcela(id_parcela: number): Promise<Parcela> {
    const parcela = await this.parcela_repo.findOne({
      where: { id_parcela, fecha_baja_parcela: IsNull() },
      relations: ['finca'],
    });
    if (!parcela) {
      throw resourceNotFound();
    }
    return parcela;
  }

  private async require_plan(
    id_plan_accion: number,
    relations: string[] = [],
  ): Promise<PlanAccion> {
    const plan = await this.plan_repo.findOne({
      where: { id_plan_accion },
      relations,
    });
    if (!plan) {
      throw resourceNotFound();
    }
    return plan;
  }

  private async require_plan_activo(id_plan_accion: number): Promise<PlanAccion> {
    const plan = await this.require_plan(id_plan_accion, [
      'parcela',
      'parcela.finca',
    ]);
    if (plan.estado !== EstadoPlanAccion.ACTIVO) {
      throw invalidStatusTransition(
        'No se pueden modificar las tareas de un plan que no está activo.',
      );
    }
    return plan;
  }

  private async require_tarea(
    id_plan_accion: number,
    id_tarea: number,
  ): Promise<Tarea> {
    const tarea = await this.tarea_repo.findOne({
      where: {
        id_tarea,
        hito: { plan_accion: { id_plan_accion } },
      },
      relations: [
        'hito',
        'hito.plan_accion',
        'tipo_tarea',
        'estado_tarea',
        'responsable',
        'responsable.usuario',
      ],
    });
    if (!tarea) {
      throw resourceNotFound();
    }
    return tarea;
  }

  private async require_tarea_editable(
    id_plan_accion: number,
    id_tarea: number,
  ): Promise<Tarea> {
    const tarea = await this.require_tarea(id_plan_accion, id_tarea);
    if (tarea.estado_tarea?.es_estado_finalizador) {
      throw taskNotEditable();
    }
    return tarea;
  }

  private async build_tarea_payload(
    plan: PlanAccion,
    dto: CrearTareaPlanDto,
  ): Promise<Partial<Tarea>> {
    const tipo = await this.tipos_tarea_service.find_activo_by_id(
      dto.id_tipo_tarea,
    );
    if (!tipo) {
      throw resourceNotFound('El tipo de tarea indicado no existe.');
    }
    this.validar_campos_agro(dto, tipo.es_tipo_agroquimico);

    const responsable = await this.resolve_responsable(
      plan,
      dto.id_responsable,
    );

    return {
      nombre_tarea: dto.nombre_tarea.trim(),
      descripcion_tarea: dto.descripcion_tarea.trim(),
      fecha_planificada_tarea: to_date_only(dto.fecha_planificada_tarea),
      tipo_tarea: tipo,
      nombre_producto_aa: tipo.es_tipo_agroquimico
        ? (dto.nombre_producto_aa?.trim() ?? null)
        : null,
      dosis_aa: tipo.es_tipo_agroquimico
        ? (dto.dosis_aa?.trim() ?? null)
        : null,
      fecha_hora_aplicacion_aa:
        tipo.es_tipo_agroquimico && dto.fecha_hora_aplicacion_aa
          ? new Date(dto.fecha_hora_aplicacion_aa)
          : null,
      responsable,
    };
  }

  private validar_campos_agro(
    dto: CrearTareaPlanDto,
    es_tipo_agroquimico: boolean,
  ) {
    if (!es_tipo_agroquimico) {
      return;
    }
    if (!dto.nombre_producto_aa?.trim()) {
      throw requiredField('nombre_producto_aa');
    }
    if (!dto.dosis_aa?.trim()) {
      throw requiredField('dosis_aa');
    }
    if (!dto.fecha_hora_aplicacion_aa?.trim()) {
      throw requiredField('fecha_hora_aplicacion_aa');
    }
  }

  private async registrar_agroquimico_si_corresponde(
    tarea: Tarea,
    estado: EstadoTarea,
  ): Promise<{ message: string; registro_agroquimico_generado: boolean }> {
    const message = 'Estado de la tarea actualizado correctamente';
    if (
      !tarea.tipo_tarea?.es_tipo_agroquimico ||
      !estado.cuenta_para_cierre_exitoso
    ) {
      return { message, registro_agroquimico_generado: false };
    }

    const previo = await this.agro_repo.findOne({
      where: { tarea: { id_tarea: tarea.id_tarea } },
    });
    if (previo) {
      return {
        message:
          'Ya existe un registro de agroquímico asociado a esta tarea. No se generó un nuevo registro.',
        registro_agroquimico_generado: false,
      };
    }

    await this.agro_repo.save(
      this.agro_repo.create({
        tarea,
        nombre_producto_aa: tarea.nombre_producto_aa,
        dosis_aa: tarea.dosis_aa,
        fecha_hora_aplicacion_aa: tarea.fecha_hora_aplicacion_aa,
        responsable: tarea.responsable ?? null,
      }),
    );
    return { message, registro_agroquimico_generado: true };
  }

  private async resolve_responsable(
    plan: PlanAccion,
    id_responsable?: number | null,
  ): Promise<UsuarioFinca | null> {
    if (id_responsable == null) {
      return null;
    }
    const id_finca = Number(plan.parcela?.finca?.id_finca);
    const membresia = await this.usuario_finca_repo.findOne({
      where: { id_usuario_finca: id_responsable },
      relations: ['finca', 'usuario'],
    });
    const now = Date.now();
    const vigente =
      membresia &&
      Number(membresia.finca?.id_finca) === id_finca &&
      (membresia.fecha_fin_rol == null ||
        membresia.fecha_fin_rol.getTime() > now);
    if (!vigente) {
      throw resourceNotFound();
    }
    return membresia;
  }

  private async todas_tareas_completadas(
    id_plan_accion: number,
  ): Promise<boolean> {
    const tareas = await this.tarea_repo.find({
      where: { hito: { plan_accion: { id_plan_accion } } },
      relations: ['estado_tarea'],
    });
    const todas_finalizadas =
      tareas.length > 0 &&
      tareas.every((tarea) => tarea.estado_tarea?.es_estado_finalizador);
    const alguna_exitosa = tareas.some(
      (tarea) => tarea.estado_tarea?.cuenta_para_cierre_exitoso,
    );
    return todas_finalizadas && alguna_exitosa;
  }

  private to_tarea_response(tarea: Tarea) {
    const es_agro = Boolean(tarea.tipo_tarea?.es_tipo_agroquimico);
    const usuario = tarea.responsable?.usuario;
    return {
      id_tarea: Number(tarea.id_tarea),
      nombre_tarea: tarea.nombre_tarea,
      descripcion_tarea: tarea.descripcion_tarea,
      fecha_planificada_tarea: to_date_only(tarea.fecha_planificada_tarea),
      fecha_ejecucion_tarea: to_iso(tarea.fecha_ejecucion_tarea),
      fecha_creacion_tarea:
        to_iso(tarea.fecha_creacion_tarea) ?? new Date().toISOString(),
      id_tipo_tarea: Number(tarea.tipo_tarea?.id_tipo_tarea),
      nombre_tipo_tarea: tarea.tipo_tarea?.nombre_tipo_tarea ?? 'Tipo de tarea',
      id_estado_tarea: Number(tarea.estado_tarea?.id_estado_tarea),
      nombre_estado_tarea: tarea.estado_tarea?.nombre_estado_tarea ?? '',
      atrasada: this.calcular_atrasada(tarea),
      nombre_producto_aa: es_agro ? tarea.nombre_producto_aa : null,
      dosis_aa: es_agro ? tarea.dosis_aa : null,
      id_responsable: tarea.responsable
        ? Number(tarea.responsable.id_usuario_finca)
        : null,
      nombre_responsable: usuario
        ? `${usuario.nombre} ${usuario.apellido}`.trim()
        : null,
      fecha_hora_aplicacion_aa: es_agro
        ? to_iso(tarea.fecha_hora_aplicacion_aa)
        : null,
    };
  }

  private calcular_atrasada(tarea: Tarea): boolean {
    if (tarea.estado_tarea?.es_estado_finalizador) {
      return false;
    }
    return to_date_only(tarea.fecha_planificada_tarea) < today_iso();
  }

  private async superficie_disponible(parcela: Parcela): Promise<number> {
    const planes = await this.plan_repo.find({
      where: {
        parcela: { id_parcela: parcela.id_parcela },
        estado: EstadoPlanAccion.ACTIVO,
      },
    });
    const ocupada = planes.reduce(
      (total, plan) => total + Number(plan.superficie_ocupada_pa),
      0,
    );
    return Number(parcela.superficie_parcela) - ocupada;
  }

  private async find_plantillas_del_cultivo(
    id_cultivo_base: number,
  ): Promise<PlantillaCultivoVariedad[]> {
    const pcvs = await this.pcv_repo.find({
      where: { cultivo_base: { id_cultivo_base } },
      relations: [
        'plantilla_base',
        'plantilla_base.hitos',
        'plantilla_base.hitos.tareas',
        'plantilla_base.hitos.tareas.tipo_tarea',
        'variedad',
      ],
    });
    return pcvs.filter((pcv) => pcv.plantilla_base?.fecha_baja_pb == null);
  }

  private async find_plantilla_para_variedad(
    id_cultivo_base: number,
    id_variedad: number,
  ): Promise<PlantillaBase | null> {
    const pcvs = await this.find_plantillas_del_cultivo(id_cultivo_base);
    const especifica = pcvs.find(
      (pcv) => Number(pcv.variedad?.id_variedad) === Number(id_variedad),
    );
    if (especifica) {
      return especifica.plantilla_base;
    }
    return (
      pcvs.find((pcv) => pcv.variedad == null)?.plantilla_base ?? null
    );
  }
}

function add_days_iso(fecha: string, days: number): string {
  const [year, month, day] = fecha.split('-').map(Number);
  const date = new Date(Date.UTC(year, month - 1, day + days));
  return date.toISOString().slice(0, 10);
}

function to_date_only(value: Date | string): string {
  if (typeof value === 'string' && /^\d{4}-\d{2}-\d{2}/.test(value)) {
    return value.slice(0, 10);
  }
  const date = value instanceof Date ? value : new Date(value);
  return date.toISOString().slice(0, 10);
}

function to_iso(value: Date | string | null | undefined): string | null {
  if (value == null) {
    return null;
  }
  if (value instanceof Date) {
    return value.toISOString();
  }
  const parsed = new Date(value);
  return Number.isNaN(parsed.getTime()) ? String(value) : parsed.toISOString();
}

function today_iso(): string {
  return new Date().toISOString().slice(0, 10);
}
