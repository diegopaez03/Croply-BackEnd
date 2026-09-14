import {
  Column,
  Entity,
  PrimaryGeneratedColumn,
} from 'typeorm';
import { CodigoTipoSensor } from '../enums/codigo-tipo-sensor.enum';

@Entity('tipos_sensor')
export class TipoSensor {
  @PrimaryGeneratedColumn({ name: 'id_tipo_sensor', type: 'bigint' })
  id_tipo_sensor: number;

  @Column({ name: 'codigo_tipo_sensor' })
  codigo_tipo_sensor: CodigoTipoSensor;

  @Column({ name: 'nombre_tipo_sensor' })
  nombre_tipo_sensor: string;

  @Column({ name: 'unidad_medida_ts' })
  unidad_medida_ts: string;

  @Column({
    name: 'fecha_alta',
    type: 'timestamptz',
    default: () => 'CURRENT_TIMESTAMP',
  })
  fecha_alta: Date;

  @Column({ name: 'fecha_baja', type: 'timestamptz', nullable: true })
  fecha_baja: Date | null;
}
