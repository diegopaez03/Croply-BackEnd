import {
  Column,
  Entity,
  JoinColumn,
  ManyToOne,
  PrimaryGeneratedColumn,
} from 'typeorm';
import { EstadoTransmision } from '../../../common/enums';
import { TipoSensor } from '../../tipos-sensor/entities/tipo-sensor.entity';
import { ControladorSensor } from './controlador-sensor.entity';

@Entity('sensores')
export class Sensor {
  @PrimaryGeneratedColumn({ name: 'id_sensor', type: 'bigint' })
  id_sensor: number;

  @Column({ name: 'ip_sensor' })
  ip_sensor: string;

  @Column({ type: 'enum', enum: EstadoTransmision, default: EstadoTransmision.SIN_SENAL })
  estado_senal: EstadoTransmision;

  @Column({ name: 'ultimo_valor', type: 'double precision', nullable: true })
  ultimo_valor: number | null;

  @Column({ name: 'fecha_ultima_lectura', type: 'timestamptz', nullable: true })
  fecha_ultima_lectura: Date | null;

  @Column({ name: 'fecha_alta', type: 'timestamptz', default: () => 'CURRENT_TIMESTAMP' })
  fecha_alta: Date;

  @Column({ name: 'fecha_baja', type: 'timestamptz', nullable: true })
  fecha_baja: Date | null;

  @ManyToOne(() => ControladorSensor, (controlador) => controlador.sensores, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'id_controlador_sensor' })
  controlador: ControladorSensor;

  @ManyToOne(() => TipoSensor, { eager: true, onDelete: 'RESTRICT' })
  @JoinColumn({ name: 'id_tipo_sensor' })
  tipo_sensor: TipoSensor;
}
