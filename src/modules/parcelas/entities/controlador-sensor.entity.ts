import {
  Column,
  Entity,
  JoinColumn,
  ManyToOne,
  OneToMany,
  PrimaryGeneratedColumn,
} from 'typeorm';
import { EstadoTransmision } from '../../../common/enums';
import { Parcela } from './parcela.entity';
import { Sensor } from './sensor.entity';

@Entity('controladores_sensor')
export class ControladorSensor {
  @PrimaryGeneratedColumn({ name: 'id_controlador_sensor', type: 'bigint' })
  id_controlador_sensor: number;

  @Column({ name: 'nombre_controlador' })
  nombre_controlador: string;

  @Column({ name: 'ip_controlador' })
  ip_controlador: string;

  @Column({ type: 'enum', enum: EstadoTransmision, default: EstadoTransmision.TRANSMITIENDO })
  estado_controlador: EstadoTransmision;

  @Column({ name: 'fecha_alta', type: 'timestamptz', default: () => 'CURRENT_TIMESTAMP' })
  fecha_alta: Date;

  @Column({ name: 'fecha_baja', type: 'timestamptz', nullable: true })
  fecha_baja: Date | null;

  @ManyToOne(() => Parcela, (parcela) => parcela.controladores, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'id_parcela' })
  parcela: Parcela;

  @OneToMany(() => Sensor, (sensor) => sensor.controlador)
  sensores: Sensor[];
}
