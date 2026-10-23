import { Injectable, Logger } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { InjectRepository } from '@nestjs/typeorm';
import { DataSource, IsNull, Repository } from 'typeorm';
import { EstadoParcela, EstadoPlanAccion } from '../../common/enums';
import { resourceNotFound } from '../../common/exceptions';
import { Finca } from '../fincas/entities/finca.entity';
import { UsuarioFinca } from '../fincas/entities/usuario-finca.entity';
import { ClimaService } from '../fincas/clima.service';
import { PlanAccion } from '../planes-accion/entities/plan-accion.entity';
import {
  AiIntegrationService,
  AlertaMotor,
} from '../recomendaciones/ai-integration.service';
import { EstadoAlertaClimatica } from './enums/estado-alerta-climatica.enum';
import { TipoNotificacion } from './enums/tipo-notificacion.enum';
import { dias_desde_fecha, etapa_fenologica_idx } from './etapa-fenologica';
import { AlertaClimatica } from './entities/alerta-climatica.entity';
import { Notificacion } from './entities/notificacion.entity';

const LOTE_FINCAS = 20;

const TITULOS: Record<string, string> = {
  ALERTA_HELADA: 'Alerta de helada',
  ALERTA_HELADA_AGRONOMICA: 'Alerta de helada agronómica',
  ALERTA_LLUVIA_INTENSA: 'Alerta de lluvia intensa',
  ALERTA_VIENTO_FUERTE_ZONDA: 'Alerta de viento Zonda',
  ALERTA_OLA_CALOR: 'Alerta de ola de calor',
};

@Injectable()
export class AlertasClimaticasCronService {
  private readonly logger = new Logger(AlertasClimaticasCronService.name);

  constructor(
    @InjectRepository(Finca)
    private readonly finca_repo: Repository<Finca>,
    @InjectRepository(PlanAccion)
    private readonly plan_repo: Repository<PlanAccion>,
    @InjectRepository(UsuarioFinca)
    private readonly usuario_finca_repo: Repository<UsuarioFinca>,
    @InjectRepository(AlertaClimatica)
    private readonly alerta_repo: Repository<AlertaClimatica>,
    private readonly clima_service: ClimaService,
    private readonly ai_service: AiIntegrationService,
    private readonly data_source: DataSource,
  ) {}

  @Cron(CronExpression.EVERY_HOUR)
  async ejecutar(): Promise<void> {
    let skip = 0;
    for (;;) {
      const fincas = await this.finca_repo.find({
        where: { fecha_baja_finca: IsNull() },
        order: { id_finca: 'ASC' },
        take: LOTE_FINCAS,
        skip,
      });
      if (fincas.length === 0) {
        return;
      }
      for (const finca of fincas) {
        try {
          await this.evaluar_finca(finca);
        } catch (error) {
          this.logger.error(
            `No se pudo evaluar la finca ${finca.id_finca}: ${
              error instanceof Error ? error.message : String(error)
            }`,
          );
        }
      }
      if (fincas.length < LOTE_FINCAS) {
        return;
      }
      skip += LOTE_FINCAS;
    }
  }

  async listar(id_finca: number, estado = EstadoAlertaClimatica.VIGENTE) {
    const finca = await this.finca_repo.findOne({
      where: { id_finca, fecha_baja_finca: IsNull() },
    });
    if (!finca) {
      throw resourceNotFound();
    }
    const alertas = await this.alerta_repo.find({
      where: { finca: { id_finca }, estado },
      order: { fecha_deteccion: 'DESC' },
    });
    return {
      alertas: alertas.map((alerta) => ({
        id_alerta: Number(alerta.id_alerta),
        codigo_alerta: alerta.codigo_alerta,
        severidad: alerta.severidad,
        fecha_deteccion: new Date(alerta.fecha_deteccion).toISOString(),
        descripcion: alerta.descripcion,
        estado: alerta.estado,
      })),
    };
  }

  private async evaluar_finca(finca: Finca): Promise<void> {
    const id_finca = Number(finca.id_finca);
    const pronostico =
      await this.clima_service.obtener_variables_pronostico(id_finca);
    const contextos = await this.contextos(id_finca);
    const detectadas = await this.ai_service.evaluate_climate({
      temp_min_pronostico: pronostico.temp_min_pronostico,
      temp_max_pronostico: pronostico.temp_max_pronostico,
      precip_pronostico_24h: pronostico.precip_pronostico_24h,
      viento_kmh: pronostico.viento_kmh,
      wind_gust_kmh: pronostico.wind_gust_kmh,
      humedad_relativa: pronostico.humedad_relativa,
      temp_actual: pronostico.temp_actual,
      contextos,
    });
    const usuarios = await this.usuarios_vigentes(id_finca);
    await this.sincronizar(id_finca, detectadas, usuarios);
  }

  private async contextos(id_finca: number) {
    const planes = await this.plan_repo.find({
      where: {
        estado: EstadoPlanAccion.ACTIVO,
        parcela: {
          estado_parcela: EstadoParcela.ACTIVA,
          fecha_baja_parcela: IsNull(),
          finca: { id_finca },
        },
      },
      relations: ['cultivo_base'],
    });
    const vistos = new Set<string>();
    const contextos: Array<{ cultivo: string; etapa_fenologica_idx: number }> =
      [];
    for (const plan of planes) {
      const cultivo = plan.cultivo_base?.nombre_cultivo_base
        ?.trim()
        .toLowerCase();
      if (!cultivo) continue;
      const etapa = etapa_fenologica_idx(
        cultivo,
        dias_desde_fecha(plan.fecha_inicio_pa),
      );
      if (etapa === null) continue;
      const clave = `${cultivo}:${etapa}`;
      if (vistos.has(clave)) continue;
      vistos.add(clave);
      contextos.push({ cultivo, etapa_fenologica_idx: etapa });
    }
    return contextos;
  }

  private async usuarios_vigentes(id_finca: number): Promise<number[]> {
    const membresias = await this.usuario_finca_repo.find({
      where: { finca: { id_finca } },
      relations: ['usuario'],
    });
    const ahora = Date.now();
    const ids = new Set<number>();
    for (const membresia of membresias) {
      if (
        membresia.fecha_fin_rol != null &&
        membresia.fecha_fin_rol.getTime() <= ahora
      ) {
        continue;
      }
      if (membresia.usuario?.id_usuario == null) continue;
      ids.add(Number(membresia.usuario.id_usuario));
    }
    return [...ids];
  }

  private async sincronizar(
    id_finca: number,
    detectadas: AlertaMotor[],
    usuarios: number[],
  ): Promise<void> {
    await this.data_source.transaction(async (manager) => {
      const alerta_repo = manager.getRepository(AlertaClimatica);
      const notificacion_repo = manager.getRepository(Notificacion);
      const vigentes = await alerta_repo.find({
        where: {
          finca: { id_finca },
          estado: EstadoAlertaClimatica.VIGENTE,
        },
      });
      const codigos_vigentes = new Set(
        vigentes.map((alerta) => alerta.codigo_alerta),
      );
      const codigos_detectados = new Set(
        detectadas.map((alerta) => alerta.codigo_alerta),
      );
      const ahora = new Date();

      for (const detectada of detectadas) {
        if (codigos_vigentes.has(detectada.codigo_alerta)) {
          continue;
        }
        const creada = await alerta_repo.save(
          alerta_repo.create({
            finca: { id_finca } as Finca,
            codigo_alerta: detectada.codigo_alerta,
            severidad: detectada.severidad,
            descripcion: detectada.descripcion,
            fecha_deteccion: ahora,
            estado: EstadoAlertaClimatica.VIGENTE,
            fecha_resolucion: null,
          }),
        );
        for (const id_usuario of usuarios) {
          await notificacion_repo.save(
            notificacion_repo.create({
              usuario: { id_usuario } as Notificacion['usuario'],
              alerta: creada,
              tipo: TipoNotificacion.ALERTA_CLIMATICA,
              titulo:
                TITULOS[detectada.codigo_alerta] ?? 'Alerta climática',
              mensaje: detectada.descripcion,
              leida: false,
            }),
          );
        }
      }

      for (const vigente of vigentes) {
        if (codigos_detectados.has(vigente.codigo_alerta)) {
          continue;
        }
        vigente.estado = EstadoAlertaClimatica.RESUELTA;
        vigente.fecha_resolucion = ahora;
        await alerta_repo.save(vigente);
      }
    });
  }
}
