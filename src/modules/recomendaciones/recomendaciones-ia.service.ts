import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { DataSource, IsNull, Repository } from 'typeorm';
import {
  EstadoParcela,
  EstadoPlanAccion,
  EstadoTransmision,
} from '../../common/enums';
import {
  parcelWithoutActionPlan,
  resourceNotFound,
} from '../../common/exceptions';
import { VariablesPronostico } from '../fincas/clima.service';
import { ClimaService } from '../fincas/clima.service';
import { Parcela } from '../parcelas/entities/parcela.entity';
import { PlanAccion } from '../planes-accion/entities/plan-accion.entity';
import { Tarea } from '../planes-accion/entities/tarea.entity';
import { CodigoTipoSensor } from '../tipos-sensor/enums/codigo-tipo-sensor.enum';
import {
  AiEvaluationResponse,
  AiIntegrationService,
  EvaluateParcelPayload,
} from './ai-integration.service';
import { OrigenDatos } from './dto/recomendacion-ia-response.dto';
import {
  FactorClave,
  RecomendacionIa,
} from './entities/recomendacion-ia.entity';

const VIGENCIA_MS = 60 * 60 * 1000;

@Injectable()
export class RecomendacionesIaService {
  constructor(
    @InjectRepository(RecomendacionIa)
    private readonly recomendacion_repo: Repository<RecomendacionIa>,
    @InjectRepository(Parcela)
    private readonly parcela_repo: Repository<Parcela>,
    @InjectRepository(PlanAccion)
    private readonly plan_repo: Repository<PlanAccion>,
    private readonly clima_service: ClimaService,
    private readonly ai_service: AiIntegrationService,
    private readonly data_source: DataSource,
  ) {}

  async obtener_recomendacion(id_parcela: number) {
    const parcela = await this.parcela_activa(id_parcela);
    const plan = await this.plan_activo(id_parcela);
    const previa = await this.recomendacion_repo.findOne({
      where: { parcela: { id_parcela } },
      order: { fecha_generacion: 'DESC', id_recomendacion: 'DESC' },
    });

    if (previa && this.vigente(previa)) {
      return this.sin_textos(previa)
        ? null
        : this.map_respuesta(previa, id_parcela, 'CACHE_VIGENTE');
    }

    const pronostico = await this.clima_service.obtener_variables_pronostico(
      Number(parcela.finca.id_finca),
    );
    const evaluacion = await this.ai_service.evaluate_parcel(
      this.payload(parcela, plan, pronostico, previa?.accion_recomendada),
    );

    const guardada =
      previa && previa.accion_recomendada === evaluacion.accion_recomendada
        ? await this.renovar(previa, evaluacion)
        : await this.crear(id_parcela, evaluacion);

    if (this.sin_textos(guardada)) {
      return null;
    }
    const origen =
      previa && previa.accion_recomendada === evaluacion.accion_recomendada
        ? 'CACHE_RENOVADA_SIN_LLM'
        : this.origen_nuevo(evaluacion.fuente_generacion);
    return this.map_respuesta(guardada, id_parcela, origen);
  }

  private async parcela_activa(id_parcela: number): Promise<Parcela> {
    const parcela = await this.parcela_repo.findOne({
      where: {
        id_parcela,
        estado_parcela: EstadoParcela.ACTIVA,
        fecha_baja_parcela: IsNull(),
      },
      relations: [
        'finca',
        'controladores',
        'controladores.sensores',
        'controladores.sensores.tipo_sensor',
      ],
    });
    if (!parcela || parcela.finca?.fecha_baja_finca != null) {
      throw resourceNotFound();
    }
    return parcela;
  }

  private async plan_activo(id_parcela: number): Promise<PlanAccion> {
    const plan = await this.plan_repo.findOne({
      where: {
        estado: EstadoPlanAccion.ACTIVO,
        parcela: { id_parcela },
      },
      relations: [
        'cultivo_base',
        'variedad',
        'hitos',
        'hitos.tareas',
        'hitos.tareas.tipo_tarea',
        'hitos.tareas.estado_tarea',
      ],
    });
    if (!plan?.cultivo_base) {
      throw parcelWithoutActionPlan(
        'La parcela seleccionada no tiene un plan de acción activo. No es posible generar una recomendación.',
      );
    }
    return plan;
  }

  private payload(
    parcela: Parcela,
    plan: PlanAccion,
    pronostico: VariablesPronostico,
    accion_previa?: string,
  ): EvaluateParcelPayload {
    const dias = this.dias_desde_siembra(plan.fecha_inicio_pa);
    const tareas = (plan.hitos ?? []).flatMap((hito) => hito.tareas ?? []);
    const riego = this.ultima_fecha(
      tareas,
      (tarea) => this.texto_tarea(tarea).includes('riego'),
      (tarea) => tarea.fecha_ejecucion_tarea,
    );
    const curacion = this.ultima_fecha(
      tareas,
      (tarea) => Boolean(tarea.tipo_tarea?.es_tipo_agroquimico),
      (tarea) => tarea.fecha_hora_aplicacion_aa ?? tarea.fecha_ejecucion_tarea,
    );

    return {
      parcela_id: String(parcela.id_parcela),
      finca_id: String(parcela.finca.id_finca),
      cultivo: plan.cultivo_base.nombre_cultivo_base.trim().toLowerCase(),
      variedad: plan.variedad?.nombre_variedad,
      dias_desde_siembra: dias,
      hora_del_dia: new Date().getHours(),
      ...(accion_previa ? { accion_previa } : {}),
      telemetria_iot: {
        temp_ambiente_c: this.valor_sensor(
          parcela,
          CodigoTipoSensor.TEMP_HUME_AMBIENTAL,
        ),
        humedad_ambiente_pct: null,
        humedad_suelo_pct: this.valor_sensor(
          parcela,
          CodigoTipoSensor.HUMEDAD_SUELO,
        ),
        radiacion_solar_wm2: this.valor_sensor(
          parcela,
          CodigoTipoSensor.RADIACION_SOLAR,
        ),
        ph_suelo: this.valor_sensor(parcela, CodigoTipoSensor.PH),
        lluvia_mm_24h: this.valor_sensor(
          parcela,
          CodigoTipoSensor.PRECIPITACION,
        ),
      },
      pronostico_meteo: {
        temp_min_pronostico: pronostico.temp_min_pronostico,
        temp_max_pronostico: pronostico.temp_max_pronostico,
        precip_pronostico_24h: pronostico.precip_pronostico_24h,
        viento_kmh: pronostico.viento_kmh,
        wind_gust_kmh: pronostico.wind_gust_kmh,
        et0_diario: pronostico.et0_diario,
      },
      historial_manejo: {
        dias_desde_ultimo_riego: riego
          ? this.dias_transcurridos(riego)
          : dias,
        dias_desde_ultima_curacion: curacion
          ? this.dias_transcurridos(curacion)
          : dias,
      },
    };
  }

  private async renovar(
    previa: RecomendacionIa,
    evaluacion: AiEvaluationResponse,
  ): Promise<RecomendacionIa> {
    return this.data_source.transaction(async (manager) => {
      const repo = manager.getRepository(RecomendacionIa);
      previa.severidad = evaluacion.severidad;
      previa.sensor_origen_principal = evaluacion.sensor_origen_principal;
      previa.factores_clave = this.factores(evaluacion);
      previa.valida_hasta = this.hasta(new Date());
      previa.fuente_generacion = 'bypass_sin_llm';
      return repo.save(previa);
    });
  }

  private async crear(
    id_parcela: number,
    evaluacion: AiEvaluationResponse,
  ): Promise<RecomendacionIa> {
    const ahora = new Date();
    const textos = evaluacion.recomendacion_vigente;
    return this.data_source.transaction(async (manager) => {
      const repo = manager.getRepository(RecomendacionIa);
      return repo.save(
        repo.create({
          parcela: { id_parcela } as Parcela,
          accion_recomendada: evaluacion.accion_recomendada,
          severidad: evaluacion.severidad,
          sensor_origen_principal: evaluacion.sensor_origen_principal,
          factores_clave: this.factores(evaluacion),
          titulo_corto: textos?.titulo_corto ?? null,
          texto_breve: textos?.texto_breve ?? null,
          texto_explicativo_extendido:
            textos?.texto_explicativo_extendido ?? null,
          fecha_generacion: ahora,
          valida_hasta: this.hasta(ahora),
          fuente_generacion: evaluacion.fuente_generacion,
        }),
      );
    });
  }

  private factores(evaluacion: AiEvaluationResponse): FactorClave[] {
    return (evaluacion.explicabilidad_top3_factores ?? []).map((factor) => ({
      sensor_ui: factor.sensor_ui,
      valor: factor.valor,
    }));
  }

  private map_respuesta(
    recomendacion: RecomendacionIa,
    id_parcela: number,
    origen_datos: OrigenDatos,
  ) {
    return {
      id_recomendacion: Number(recomendacion.id_recomendacion),
      id_parcela,
      accion_recomendada: recomendacion.accion_recomendada,
      severidad: recomendacion.severidad,
      sensor_origen_principal: recomendacion.sensor_origen_principal,
      factores_clave: recomendacion.factores_clave ?? [],
      titulo_corto: recomendacion.titulo_corto,
      texto_breve: recomendacion.texto_breve,
      texto_explicativo_extendido: recomendacion.texto_explicativo_extendido,
      fecha_generacion: new Date(recomendacion.fecha_generacion).toISOString(),
      valida_hasta: new Date(recomendacion.valida_hasta).toISOString(),
      origen_datos,
    };
  }

  private origen_nuevo(fuente: string): OrigenDatos {
    if (fuente === 'fallback_determinista_inta') {
      return 'FALLBACK_INTA';
    }
    return 'NUEVA_EVALUACION_LLM';
  }

  private vigente(recomendacion: RecomendacionIa): boolean {
    return new Date(recomendacion.valida_hasta).getTime() > Date.now();
  }

  private sin_textos(recomendacion: {
    titulo_corto: string | null;
    texto_breve: string | null;
    texto_explicativo_extendido: string | null;
  }): boolean {
    return (
      !recomendacion.titulo_corto &&
      !recomendacion.texto_breve &&
      !recomendacion.texto_explicativo_extendido
    );
  }

  private hasta(desde: Date): Date {
    return new Date(desde.getTime() + VIGENCIA_MS);
  }

  private valor_sensor(
    parcela: Parcela,
    codigo: CodigoTipoSensor,
  ): number | null {
    for (const controlador of parcela.controladores ?? []) {
      if (controlador.fecha_baja != null) continue;
      for (const sensor of controlador.sensores ?? []) {
        if (sensor.fecha_baja != null) continue;
        if (sensor.estado_senal !== EstadoTransmision.TRANSMITIENDO) continue;
        if (sensor.tipo_sensor?.codigo_tipo_sensor !== codigo) continue;
        if (sensor.ultimo_valor == null) continue;
        return sensor.ultimo_valor;
      }
    }
    return null;
  }

  private ultima_fecha(
    tareas: Tarea[],
    coincide: (tarea: Tarea) => boolean,
    fecha_de: (tarea: Tarea) => Date | null,
  ): Date | null {
    let mejor: Date | null = null;
    for (const tarea of tareas) {
      if (!tarea.estado_tarea?.cuenta_para_cierre_exitoso || !coincide(tarea)) {
        continue;
      }
      const fecha = fecha_de(tarea);
      if (!fecha) continue;
      if (!mejor || fecha.getTime() > mejor.getTime()) {
        mejor = fecha;
      }
    }
    return mejor;
  }

  private texto_tarea(tarea: Tarea): string {
    return `${tarea.nombre_tarea ?? ''} ${tarea.tipo_tarea?.nombre_tipo_tarea ?? ''}`.toLowerCase();
  }

  private dias_desde_siembra(fecha_inicio: string | Date): number {
    const iso =
      fecha_inicio instanceof Date
        ? fecha_inicio.toISOString().slice(0, 10)
        : String(fecha_inicio).slice(0, 10);
    const inicio = Date.parse(`${iso}T00:00:00Z`);
    const ahora = new Date();
    const hoy = Date.UTC(
      ahora.getUTCFullYear(),
      ahora.getUTCMonth(),
      ahora.getUTCDate(),
    );
    return Math.max(1, Math.floor((hoy - inicio) / 86_400_000));
  }

  private dias_transcurridos(fecha: Date): number {
    return Math.max(0, Math.floor((Date.now() - fecha.getTime()) / 86_400_000));
  }
}
