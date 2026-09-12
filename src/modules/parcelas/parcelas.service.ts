import { HttpStatus, Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { IsNull, Repository } from 'typeorm';
import {
  EstadoParcela,
  EstadoPlanAccion,
  EstadoTransmision,
} from '../../common/enums';
import {
  DomainException,
  duplicateValue,
  resourceNotFound,
} from '../../common/exceptions';
import { Finca } from '../fincas/entities/finca.entity';
import { TipoSensor } from '../tipos-sensor/entities/tipo-sensor.entity';
import { TiposSensorService } from '../tipos-sensor/tipos-sensor.service';
import { generate_token } from '../auth/auth.crypto';
import { ControladorSensor } from './entities/controlador-sensor.entity';
import { CodigoQR } from './entities/codigo-qr.entity';
import { Parcela } from './entities/parcela.entity';
import { Sensor } from './entities/sensor.entity';
import { SimuladorSincronizacionEstructuralService } from '../simulador-iot/simulador-sincronizacion-estructural.service';
import { PlanAccion } from '../planes-accion/entities/plan-accion.entity';
import {
  ActualizarParcelaDto,
  CrearParcelaDto,
} from './dto/parcelas.dto';

@Injectable()
export class ParcelasService {
  private readonly logger = new Logger(ParcelasService.name); 
  constructor(
    @InjectRepository(Parcela)
    private readonly parcela_repo: Repository<Parcela>,
    @InjectRepository(ControladorSensor)
    private readonly controlador_repo: Repository<ControladorSensor>,
    @InjectRepository(Sensor)
    private readonly sensor_repo: Repository<Sensor>,
    @InjectRepository(Finca)
    private readonly finca_repo: Repository<Finca>,
    @InjectRepository(CodigoQR)
    private readonly codigo_qr_repo: Repository<CodigoQR>,
    @InjectRepository(PlanAccion)
    private readonly plan_accion_repo: Repository<PlanAccion>,
    private readonly tipos_sensor_service: TiposSensorService,
    private readonly simulador_sincronizacion_service: SimuladorSincronizacionEstructuralService,
  ) {}

  async crear(
    id_finca: number,
    dto: CrearParcelaDto,
  ) {
    const finca = await this.require_finca(id_finca);
    await this.assert_nombre_unico(id_finca, dto.nombre_parcela);

    const parcela = await this.parcela_repo.save(
      this.parcela_repo.create({
        nombre_parcela: dto.nombre_parcela.trim(),
        superficie_parcela: dto.superficie_parcela,
        estado_parcela: EstadoParcela.ACTIVA,
        fecha_baja_parcela: null,
        finca,
      }),
    );

    // DESPUÉS
    await this.replace_controladores(parcela, dto.controladores ?? []);
    const detalle = await this.require_parcela(id_finca, parcela.id_parcela);

    try {
      await this.simulador_sincronizacion_service.sincronizar_creacion(detalle);
    } catch (error) {
      // La parcela ya quedó guardada en Croply (arriba). Un fallo del simulador
      // (caído, red, timeout, etc.) no debe tirar abajo esta respuesta.
      // TODO: cuando exista el módulo de Notificaciones, disparar acá el aviso
      // al Admin Croply en vez de solo loguear.
      this.logger.error(
        `Fallo al sincronizar creación de parcela ${detalle.id_parcela} con el simulador`,
        error instanceof Error ? error.stack : String(error),
      );
    }

    return {
      message: 'Parcela creada correctamente',
      ...this.map_parcela(detalle),
    };
  }


  async actualizar(
  id_finca: number,
  id_parcela: number,
  dto: ActualizarParcelaDto,
) {
  const parcela = await this.require_parcela(id_finca, id_parcela);

  if (dto.nombre_parcela !== undefined) {
    await this.assert_nombre_unico(id_finca, dto.nombre_parcela, id_parcela);
    parcela.nombre_parcela = dto.nombre_parcela.trim();
  }
  if (dto.superficie_parcela !== undefined) {
    parcela.superficie_parcela = dto.superficie_parcela;
  }
  await this.parcela_repo.save(parcela);

  if (dto.controladores !== undefined) {
    await this.replace_controladores(parcela, dto.controladores);
  }
  const detalle = await this.require_parcela(id_finca, id_parcela);

  // TODO ESTE BLOQUE es nuevo, reemplaza la línea que tenías:
  // await this.simulador_sincronizacion_service.sincronizar_actualizacion(detalle);
  try {
    await this.simulador_sincronizacion_service.sincronizar_actualizacion(detalle);
  } catch (error) {
    this.logger.error(
      `Fallo al sincronizar actualización de parcela ${detalle.id_parcela} con el simulador`,
      error instanceof Error ? error.stack : String(error),
    );
  }

  return {
    message: 'Parcela actualizada correctamente',
  };
}

  async dar_baja(id_finca: number, id_parcela: number) {
    const parcela = await this.require_parcela(id_finca, id_parcela);
    parcela.estado_parcela = EstadoParcela.INACTIVA;
    parcela.fecha_baja_parcela = new Date();
    await this.parcela_repo.save(parcela);

    const controladores = await this.controlador_repo.find({
      where: { parcela: { id_parcela }, fecha_baja: IsNull() },
      relations: ['sensores'],
    });
    const fecha_baja = new Date();
    for (const controlador of controladores) {
      controlador.fecha_baja = fecha_baja;
      await this.controlador_repo.save(controlador);
      for (const sensor of controlador.sensores ?? []) {
        if (sensor.fecha_baja == null) {
          sensor.fecha_baja = fecha_baja;
          await this.sensor_repo.save(sensor);
        }
      }
    }
    await this.simulador_sincronizacion_service.sincronizar_baja(parcela);

    return {
      message:
        'Parcela dada de baja correctamente. Las tareas pendientes fueron canceladas y el cultivo activo fue inactivado.',
    };
  }

  async generar_codigo_qr(id_parcela: number) {
    const parcela = await this.require_parcela_sin_infraestructura(id_parcela);
    const existente = await this.codigo_qr_repo.findOne({
      where: { parcela: { id_parcela } },
    });
    if (existente) {
      return this.map_codigo_qr(existente);
    }

    const codigo_qr = generate_token();
    const codigo = await this.codigo_qr_repo.save(
      this.codigo_qr_repo.create({
        codigo_qr,
        url_acceso_qr: `https://app.croply.com/parcelas/${parcela.id_parcela}?qr=${codigo_qr}`,
        fecha_generacion_qr: new Date(),
        parcela,
      }),
    );
    return {
      message: 'Código QR generado correctamente',
      ...this.map_codigo_qr(codigo),
    };
  }

  async consultar_codigo_qr(id_parcela: number) {
    await this.require_parcela_sin_infraestructura(id_parcela);
    const codigo = await this.codigo_qr_repo.findOne({
      where: { parcela: { id_parcela } },
    });
    if (!codigo) {
      throw resourceNotFound();
    }
    return this.map_codigo_qr(codigo);
  }

  async detalle(id_parcela: number) {
    const parcela = await this.parcela_repo.findOne({
      where: { id_parcela },
      relations: [
        'finca',
        'controladores',
        'controladores.sensores',
        'controladores.sensores.tipo_sensor',
        'codigo_qr',
      ],
    });
    if (!parcela) {
      throw resourceNotFound();
    }

    const planes = await this.plan_accion_repo.find({
      where: { parcela: { id_parcela }, estado: EstadoPlanAccion.ACTIVO },
      relations: ['cultivo_base', 'variedad'],
    });

    return {
      id_parcela: Number(parcela.id_parcela),
      id_finca: Number(parcela.finca.id_finca),
      nombre_parcela: parcela.nombre_parcela,
      superficie_parcela: Number(parcela.superficie_parcela),
      estado_parcela: parcela.estado_parcela,
      fecha_generacion_qr: parcela.codigo_qr?.fecha_generacion_qr ?? null,
      cultivos: planes.map((plan) => ({
        id_plan_accion: Number(plan.id_plan_accion),
        id_cultivo_base: Number(plan.cultivo_base.id_cultivo_base),
        nombre_cultivo_base: plan.cultivo_base.nombre_cultivo_base,
        id_variedad: plan.variedad ? Number(plan.variedad.id_variedad) : null,
        nombre_variedad: plan.variedad?.nombre_variedad ?? null,
        superficie_ocupada_pa: plan.superficie_ocupada_pa,
        fecha_inicio_pa: plan.fecha_inicio_pa,
        estado: plan.estado,
      })),
      sensores: (parcela.controladores ?? []).flatMap((controlador) =>
        (controlador.sensores ?? []).map((sensor) => ({
          id_sensor: Number(sensor.id_sensor),
          codigo_tipo_sensor: sensor.tipo_sensor.codigo_tipo_sensor,
          nombre_tipo_sensor: sensor.tipo_sensor.nombre_tipo_sensor,
          estado_senal: sensor.estado_senal,
        })),
      ),
    };
  }

  async resumen(id_parcela: number) {
    const parcela = await this.parcela_repo.findOne({
      where: { id_parcela, fecha_baja_parcela: IsNull() },
    });
    if (!parcela) {
      throw resourceNotFound();
    }

    const plan = await this.plan_accion_repo.findOne({
      where: { parcela: { id_parcela }, estado: EstadoPlanAccion.ACTIVO },
      relations: ['cultivo_base', 'variedad'],
    });

    return {
      id_parcela: Number(parcela.id_parcela),
      nombre_parcela: parcela.nombre_parcela,
      estado_parcela: parcela.estado_parcela,
      cultivo: plan
        ? {
            nombre_cultivo_base: plan.cultivo_base.nombre_cultivo_base,
            nombre_variedad: plan.variedad.nombre_variedad,
            superficie_ocupada_pa: plan.superficie_ocupada_pa,
          }
        : null,
      recomendacion_ia_resumen: null,
    };
  }

  async require_parcela(id_finca: number, id_parcela: number): Promise<Parcela> {
    const parcela = await this.parcela_repo.findOne({
      where: {
        id_parcela,
        estado_parcela: EstadoParcela.ACTIVA,
        finca: { id_finca },
      },
      relations: [
        'finca',
        'controladores',
        'controladores.sensores',
        'controladores.sensores.tipo_sensor',
      ],
    });
    if (!parcela) {
      throw resourceNotFound();
    }
    return parcela;
  }

  private async require_parcela_sin_infraestructura(
    id_parcela: number,
  ): Promise<Parcela> {
    const parcela = await this.parcela_repo.findOne({
      where: { id_parcela, estado_parcela: EstadoParcela.ACTIVA },
      relations: ['finca'],
    });
    if (!parcela || parcela.finca?.fecha_baja_finca != null) {
      throw resourceNotFound();
    }
    return parcela;
  }

  private async require_finca(id_finca: number): Promise<Finca> {
    const finca = await this.finca_repo.findOne({
      where: { id_finca, fecha_baja_finca: IsNull() },
    });
    if (!finca) {
      throw resourceNotFound();
    }
    return finca;
  }

  private async assert_nombre_unico(
    id_finca: number,
    nombre_parcela: string,
    id_parcela?: number,
  ): Promise<void> {
    const existente = await this.parcela_repo.findOne({
      where: {
        nombre_parcela: nombre_parcela.trim(),
        finca: { id_finca },
        estado_parcela: EstadoParcela.ACTIVA,
      },
    });
    if (existente && Number(existente.id_parcela) !== Number(id_parcela)) {
      throw duplicateValue('nombre_parcela');
    }
  }

  private async replace_controladores(
    parcela: Parcela,
    incoming: Array<{
      id_controlador_sensor?: number;
      nombre_controlador: string;
      ip_controlador: string;
      sensores?: Array<{ id_sensor?: number; id_tipo_sensor: number; ip_sensor: string }>;
    }>,
  ): Promise<void> {
    const existentes = await this.controlador_repo.find({
      where: { parcela: { id_parcela: parcela.id_parcela } },
      relations: ['sensores', 'sensores.tipo_sensor'],
    });
    const ids_conservados = new Set<number>();

    for (const datos of incoming) {
      let controlador: ControladorSensor | undefined;
      if (datos.id_controlador_sensor !== undefined) {
        controlador = existentes.find(
          (item) => Number(item.id_controlador_sensor) === Number(datos.id_controlador_sensor),
        );
        if (!controlador || controlador.fecha_baja != null) {
          throw resourceNotFound();
        }
        ids_conservados.add(Number(controlador.id_controlador_sensor));
        controlador.nombre_controlador = datos.nombre_controlador.trim();
        controlador.ip_controlador = datos.ip_controlador;
        controlador.fecha_baja = null;
        await this.controlador_repo.save(controlador);
      } else {
        controlador = await this.controlador_repo.save(
          this.controlador_repo.create({
            nombre_controlador: datos.nombre_controlador.trim(),
            ip_controlador: datos.ip_controlador,
            estado_controlador: EstadoTransmision.TRANSMITIENDO,
            fecha_baja: null,
            parcela,
          }),
        );
      }

      await this.replace_sensores(controlador, datos.sensores ?? []);
    }

    const fecha_baja = new Date();
    for (const controlador of existentes) {
      if (
        controlador.fecha_baja == null &&
        !ids_conservados.has(Number(controlador.id_controlador_sensor))
      ) {
        controlador.fecha_baja = fecha_baja;
        await this.controlador_repo.save(controlador);
        for (const sensor of controlador.sensores ?? []) {
          if (sensor.fecha_baja == null) {
            sensor.fecha_baja = fecha_baja;
            await this.sensor_repo.save(sensor);
          }
        }
      }
    }
  }

  private async replace_sensores(
    controlador: ControladorSensor,
    incoming: Array<{ id_sensor?: number; id_tipo_sensor: number; ip_sensor: string }>,
  ): Promise<void> {
    const existentes = controlador.sensores ?? [];
    const ids_conservados = new Set<number>();

    for (const datos of incoming) {
      let sensor: Sensor | undefined;
      if (datos.id_sensor !== undefined) {
        sensor = existentes.find(
          (item) => Number(item.id_sensor) === Number(datos.id_sensor),
        );
        if (!sensor || sensor.fecha_baja != null) {
          throw resourceNotFound();
        }
        ids_conservados.add(Number(sensor.id_sensor));
        sensor.ip_sensor = datos.ip_sensor;
        sensor.tipo_sensor = await this.require_tipo_sensor(datos.id_tipo_sensor);
        sensor.fecha_baja = null;
        await this.sensor_repo.save(sensor);
      } else {
        sensor = this.sensor_repo.create({
          ip_sensor: datos.ip_sensor,
          estado_senal: EstadoTransmision.SIN_SENAL,
          ultimo_valor: null,
          fecha_ultima_lectura: null,
          fecha_baja: null,
          controlador,
          tipo_sensor: await this.require_tipo_sensor(datos.id_tipo_sensor),
        });
        await this.sensor_repo.save(sensor);
      }
    }

    const fecha_baja = new Date();
    for (const sensor of existentes) {
      if (
        sensor.fecha_baja == null &&
        !ids_conservados.has(Number(sensor.id_sensor))
      ) {
        sensor.fecha_baja = fecha_baja;
        await this.sensor_repo.save(sensor);
      }
    }
  }

  private async require_tipo_sensor(id_tipo_sensor: number): Promise<TipoSensor> {
    const tipo_sensor = await this.tipos_sensor_service.find_activo_by_id(id_tipo_sensor);
    if (!tipo_sensor) {
      throw new DomainException(
        'RESOURCE_NOT_FOUND',
        'El recurso solicitado no existe o ya fue eliminado.',
        HttpStatus.NOT_FOUND,
      );
    }
    return tipo_sensor;
  }

  private map_parcela(parcela: Parcela) {
    return {
      id_parcela: Number(parcela.id_parcela),
      id_finca: Number(parcela.finca.id_finca),
      nombre_parcela: parcela.nombre_parcela,
      superficie_parcela: parcela.superficie_parcela,
      estado_parcela: parcela.estado_parcela,
      controladores: (parcela.controladores ?? [])
        .filter((controlador) => controlador.fecha_baja == null)
        .map((controlador) => ({
          id_controlador_sensor: Number(controlador.id_controlador_sensor),
          nombre_controlador: controlador.nombre_controlador,
          ip_controlador: controlador.ip_controlador,
          estado_controlador: controlador.estado_controlador,
          sensores: (controlador.sensores ?? [])
            .filter((sensor) => sensor.fecha_baja == null)
            .map((sensor) => ({
              id_sensor: Number(sensor.id_sensor),
              id_tipo_sensor: Number(sensor.tipo_sensor.id_tipo_sensor),
              codigo_tipo_sensor: sensor.tipo_sensor.codigo_tipo_sensor,
              nombre_tipo_sensor: sensor.tipo_sensor.nombre_tipo_sensor,
              ip_sensor: sensor.ip_sensor,
              estado_senal: sensor.estado_senal,
              ultimo_valor: sensor.ultimo_valor,
              fecha_ultima_lectura: sensor.fecha_ultima_lectura,
            })),
        })),
    };
  }

  private map_codigo_qr(codigo: CodigoQR) {
    return {
      url_acceso_qr: codigo.url_acceso_qr,
      fecha_generacion_qr: codigo.fecha_generacion_qr
        .toISOString()
        .slice(0, 10),
    };
  }
}
