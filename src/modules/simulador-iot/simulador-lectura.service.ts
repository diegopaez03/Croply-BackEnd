import { HttpService } from '@nestjs/axios';
import { Injectable, OnModuleInit } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { SchedulerRegistry } from '@nestjs/schedule';
import { CronJob } from 'cron';
import { InjectRepository } from '@nestjs/typeorm';
import { IsNull, Repository } from 'typeorm';
import { EstadoParcela, EstadoTransmision } from '../../common/enums';
import { resourceNotFound } from '../../common/exceptions';
import { Parcela } from '../parcelas/entities/parcela.entity';
import { Sensor } from '../parcelas/entities/sensor.entity';
import { LecturaSensor } from './entities/lectura-sensor.entity';

interface EstadoSimuladorDto {
  controladores?: Array<{
    controlador_id: number;
    sensores?: Array<{
      sensor_id: number;
      valor_actual: number | null;
      fecha_ultima_lectura: string | null;
    }>;
  }>;
}

@Injectable()
export class SimuladorLecturaService implements OnModuleInit {
  private readonly nombre_job = 'simulador-lecturas';
  private readonly intervalo_minutos: number;
  private readonly tolerancia_ciclos: number;

  constructor(
    @InjectRepository(Parcela)
    private readonly parcela_repo: Repository<Parcela>,
    @InjectRepository(Sensor)
    private readonly sensor_repo: Repository<Sensor>,
    @InjectRepository(LecturaSensor)
    private readonly lectura_repo: Repository<LecturaSensor>,
    private readonly http: HttpService,
    private readonly config: ConfigService,
    private readonly scheduler: SchedulerRegistry,
  ) {
    this.intervalo_minutos = this.read_positive_integer(
      'SIMULADOR_SYNC_INTERVAL_MINUTES',
      25,
    );
    this.tolerancia_ciclos = this.read_positive_integer(
      'SIMULADOR_SYNC_TOLERANCIA_CICLOS',
      2,
    );
  }

  onModuleInit(): void {
    const job = new CronJob(
      `*/${this.intervalo_minutos} * * * *`,
      () => void this.sincronizar_lecturas(),
    );
    this.scheduler.addCronJob(this.nombre_job, job);
    job.start();
  }

  async sincronizar_lecturas(): Promise<void> {
    const parcelas = await this.parcela_repo.find({
      where: {
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

    for (const parcela of parcelas) {
      const sensores = this.active_sensors(parcela);
      if (sensores.length === 0) {
        continue;
      }

      try {
        const estado = await this.get_estado(parcela.id_parcela);
        await this.apply_estado(sensores, estado);
      } catch {
        await this.mark_without_signal(sensores);
      }
    }
  }

  async obtener_monitoreo(id_parcela: number) {
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

    const sensores = this.active_sensors(parcela);
    const sensores_response = sensores.map((sensor) => ({
      id_sensor: Number(sensor.id_sensor),
      nombre_tipo_sensor: sensor.tipo_sensor.nombre_tipo_sensor,
      unidad_medida_ts: sensor.tipo_sensor.unidad_medida_ts,
      ultimo_valor: sensor.ultimo_valor,
      fecha_ultima_lectura: sensor.fecha_ultima_lectura,
      estado_senal: sensor.estado_senal,
    }));

    return {
      estado_general:
        sensores_response.length === 0
          ? null
          : sensores_response.some(
                (sensor) =>
                  sensor.estado_senal === EstadoTransmision.TRANSMITIENDO,
              )
            ? EstadoTransmision.TRANSMITIENDO
            : EstadoTransmision.SIN_SENAL,
      sensores: sensores_response,
    };
  }

  private async get_estado(id_parcela: number): Promise<EstadoSimuladorDto> {
    const base_url = this.config.get<string>('SIMULADOR_BASE_URL', '').replace(/\/$/, '');
    return (
      await this.http.axiosRef.get<EstadoSimuladorDto>(
        `${base_url}/parcelas/${Number(id_parcela)}/estado`,
      )
    ).data;
  }

  private async apply_estado(
    sensores: Sensor[],
    estado: EstadoSimuladorDto,
  ): Promise<void> {
    const lecturas = new Map<number, EstadoSimuladorDto['controladores'][number]['sensores'][number]>();
    for (const controlador of estado.controladores ?? []) {
      for (const lectura of controlador.sensores ?? []) {
        lecturas.set(Number(lectura.sensor_id), lectura);
      }
    }

    const limite = Date.now() - this.intervalo_minutos * this.tolerancia_ciclos * 60_000;
    for (const sensor of sensores) {
      const lectura = lecturas.get(Number(sensor.id_sensor));
      if (
        !lectura ||
        lectura.valor_actual == null ||
        lectura.fecha_ultima_lectura == null
      ) {
        sensor.estado_senal = EstadoTransmision.SIN_SENAL;
        await this.sensor_repo.save(sensor);
        continue;
      }

      if (sensor.ultimo_valor != null) {
        await this.lectura_repo.save(
          this.lectura_repo.create({
            valor_lectura_sensor: sensor.ultimo_valor,
            fecha_hora_lectura: sensor.fecha_ultima_lectura ?? new Date(),
            sensor,
          }),
        );
      }

      const fecha_lectura = new Date(lectura.fecha_ultima_lectura);
      sensor.ultimo_valor = lectura.valor_actual;
      sensor.fecha_ultima_lectura = fecha_lectura;
      sensor.estado_senal =
        fecha_lectura.getTime() >= limite
          ? EstadoTransmision.TRANSMITIENDO
          : EstadoTransmision.SIN_SENAL;
      await this.sensor_repo.save(sensor);
    }
  }

  private async mark_without_signal(sensores: Sensor[]): Promise<void> {
    for (const sensor of sensores) {
      sensor.estado_senal = EstadoTransmision.SIN_SENAL;
      await this.sensor_repo.save(sensor);
    }
  }

  private active_sensors(parcela: Parcela): Sensor[] {
    return (parcela.controladores ?? [])
      .filter((controlador) => controlador.fecha_baja == null)
      .flatMap((controlador) => controlador.sensores ?? [])
      .filter((sensor) => sensor.fecha_baja == null);
  }

  private read_positive_integer(name: string, fallback: number): number {
    const value = Number(this.config.get<string>(name, String(fallback)));
    return Number.isInteger(value) && value > 0 ? value : fallback;
  }
}
