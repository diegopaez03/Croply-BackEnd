import { HttpStatus, Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { IsNull, Repository } from 'typeorm';
import { TipoOperacion } from '../../common/enums';
import {
  DomainException,
  resourceInUse,
  resourceNotFound,
} from '../../common/exceptions';
import { LogOperacionesService } from '../log-operaciones';
import { Sensor } from '../parcelas/entities/sensor.entity';
import { Usuario } from '../usuarios/entities/usuario.entity';
import { ActualizarTipoSensorDto } from './dto/actualizar-tipo-sensor.dto';
import { CrearTipoSensorDto } from './dto/crear-tipo-sensor.dto';
import { CodigoTipoSensor } from './enums/codigo-tipo-sensor.enum';
import { TipoSensor } from './entities/tipo-sensor.entity';

@Injectable()
export class TiposSensorService {
  constructor(
    @InjectRepository(TipoSensor)
    private readonly tipo_sensor_repo: Repository<TipoSensor>,
    @InjectRepository(Sensor)
    private readonly sensor_repo: Repository<Sensor>,
    private readonly log_service: LogOperacionesService,
  ) {}

  async listar() {
    const tipos_sensor = await this.tipo_sensor_repo.find({
      where: { fecha_baja: IsNull() },
    });

    return {
      tipos_sensor: tipos_sensor.map((tipo_sensor) => ({
        id_tipo_sensor: Number(tipo_sensor.id_tipo_sensor),
        codigo_tipo_sensor: tipo_sensor.codigo_tipo_sensor,
        nombre_tipo_sensor: tipo_sensor.nombre_tipo_sensor,
        unidad_medida_ts: tipo_sensor.unidad_medida_ts,
      })),
    };
  }

  async crear(dto: CrearTipoSensorDto, actor: Usuario) {
    this.validar_codigo_tipo_sensor(dto.codigo_tipo_sensor);

    const tipo_sensor = await this.tipo_sensor_repo.save(
      this.tipo_sensor_repo.create({
        codigo_tipo_sensor: dto.codigo_tipo_sensor,
        nombre_tipo_sensor: dto.nombre_tipo_sensor,
        unidad_medida_ts: dto.unidad_medida_ts,
      }),
    );

    await this.log_service.registrar({
      usuario: actor,
      tipo_operacion: TipoOperacion.EXITO,
      descripcion: `Alta de tipo de sensor ${tipo_sensor.nombre_tipo_sensor}`,
      recurso: `TipoSensor:${tipo_sensor.id_tipo_sensor}`,
    });

    return {
      message: 'Tipo de sensor creado correctamente.',
      id_tipo_sensor: Number(tipo_sensor.id_tipo_sensor),
      codigo_tipo_sensor: tipo_sensor.codigo_tipo_sensor,
      nombre_tipo_sensor: tipo_sensor.nombre_tipo_sensor,
      unidad_medida_ts: tipo_sensor.unidad_medida_ts,
      fecha_alta: tipo_sensor.fecha_alta,
      fecha_baja: tipo_sensor.fecha_baja,
    };
  }

  async actualizar(
    id_tipo_sensor: number,
    dto: ActualizarTipoSensorDto,
    actor: Usuario,
  ) {
    const tipo_sensor = await this.require_tipo_sensor_activo(id_tipo_sensor);
    this.validar_codigo_tipo_sensor(dto.codigo_tipo_sensor);

    tipo_sensor.codigo_tipo_sensor = dto.codigo_tipo_sensor;
    tipo_sensor.nombre_tipo_sensor = dto.nombre_tipo_sensor;
    tipo_sensor.unidad_medida_ts = dto.unidad_medida_ts;
    await this.tipo_sensor_repo.save(tipo_sensor);

    await this.log_service.registrar({
      usuario: actor,
      tipo_operacion: TipoOperacion.EXITO,
      descripcion: `Actualización de tipo de sensor ${tipo_sensor.nombre_tipo_sensor}`,
      recurso: `TipoSensor:${tipo_sensor.id_tipo_sensor}`,
    });

    return {
      message: 'Tipo de sensor actualizado correctamente.',
      id_tipo_sensor: Number(tipo_sensor.id_tipo_sensor),
      codigo_tipo_sensor: tipo_sensor.codigo_tipo_sensor,
      nombre_tipo_sensor: tipo_sensor.nombre_tipo_sensor,
      unidad_medida_ts: tipo_sensor.unidad_medida_ts,
    };
  }

  async dar_baja(id_tipo_sensor: number, actor: Usuario) {
    const tipo_sensor = await this.require_tipo_sensor_activo(id_tipo_sensor);
    const sensores_activos =
      await this.contar_sensores_activos_asociados(id_tipo_sensor);

    if (sensores_activos > 0) {
      throw resourceInUse(
        'No es posible dar de baja este tipo de sensor porque está asignado a una o más parcelas.',
      );
    }

    tipo_sensor.fecha_baja = new Date();
    await this.tipo_sensor_repo.save(tipo_sensor);

    await this.log_service.registrar({
      usuario: actor,
      tipo_operacion: TipoOperacion.OPERACION_DESTRUCTIVA,
      descripcion: `Baja de tipo de sensor ${tipo_sensor.nombre_tipo_sensor}`,
      recurso: `TipoSensor:${tipo_sensor.id_tipo_sensor}`,
    });

    return {
      message: 'Tipo de sensor dado de baja correctamente.',
      id_tipo_sensor: Number(tipo_sensor.id_tipo_sensor),
    };
  }

  codigos_disponibles() {
    return Object.values(CodigoTipoSensor);
  }

  async find_activo_by_id(id_tipo_sensor: number): Promise<TipoSensor | null> {
    return this.tipo_sensor_repo.findOne({
      where: { id_tipo_sensor, fecha_baja: IsNull() },
    });
  }

  private validar_codigo_tipo_sensor(
    codigo_tipo_sensor: CodigoTipoSensor,
  ): void {
    if (
      !Object.values(CodigoTipoSensor).includes(
        codigo_tipo_sensor as CodigoTipoSensor,
      )
    ) {
      throw new DomainException(
        'INVALID_SENSOR_TYPE_CODE',
        'El código de tipo de sensor no es válido.',
        HttpStatus.BAD_REQUEST,
        'codigo_tipo_sensor',
      );
    }
  }

  private async require_tipo_sensor_activo(
    id_tipo_sensor: number,
  ): Promise<TipoSensor> {
    const tipo_sensor = await this.tipo_sensor_repo.findOne({
      where: { id_tipo_sensor, fecha_baja: IsNull() },
    });

    if (!tipo_sensor) {
      throw resourceNotFound();
    }

    return tipo_sensor;
  }

  private async contar_sensores_activos_asociados(
    id_tipo_sensor: number,
  ): Promise<number> {
    return this.sensor_repo.count({
      where: {
        tipo_sensor: { id_tipo_sensor },
        fecha_baja: IsNull(),
      },
    });
  }
}
