import {
  Column,
  Entity,
  JoinColumn,
  ManyToOne,
  PrimaryGeneratedColumn,
} from 'typeorm';
import { Sensor } from '../../parcelas/entities/sensor.entity';

@Entity('lecturas_sensor')
export class LecturaSensor {
  @PrimaryGeneratedColumn({ name: 'id_lectura_sensor', type: 'bigint' })
  id_lectura_sensor: number;

  @Column({ name: 'valor_lectura_sensor', type: 'double precision' })
  valor_lectura_sensor: number;

  @Column({ name: 'fecha_hora_lectura', type: 'timestamptz' })
  fecha_hora_lectura: Date;

  @ManyToOne(() => Sensor, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'id_sensor' })
  sensor: Sensor;
}
