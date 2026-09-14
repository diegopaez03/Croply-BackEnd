import {
  Column,
  Entity,
  JoinColumn,
  ManyToOne,
  OneToMany,
  OneToOne,
  PrimaryGeneratedColumn,
} from 'typeorm';
import { EstadoParcela } from '../../../common/enums';
import { Finca } from '../../fincas/entities/finca.entity';
import { ControladorSensor } from './controlador-sensor.entity';
import { CodigoQR } from './codigo-qr.entity';

@Entity('parcelas')
export class Parcela {
  @PrimaryGeneratedColumn({ name: 'id_parcela', type: 'bigint' })
  id_parcela: number;

  @Column({ name: 'nombre_parcela' })
  nombre_parcela: string;

  @Column({ name: 'superficie_parcela', type: 'double precision' })
  superficie_parcela: number;

  @Column({ type: 'enum', enum: EstadoParcela, default: EstadoParcela.ACTIVA })
  estado_parcela: EstadoParcela;

  @Column({ name: 'fecha_alta_parcela', type: 'timestamptz', default: () => 'CURRENT_TIMESTAMP' })
  fecha_alta_parcela: Date;

  @Column({ name: 'fecha_baja_parcela', type: 'timestamptz', nullable: true })
  fecha_baja_parcela: Date | null;

  @ManyToOne(() => Finca, (finca) => finca.parcelas, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'id_finca' })
  finca: Finca;

  @OneToMany(() => ControladorSensor, (controlador) => controlador.parcela)
  controladores: ControladorSensor[];

  @OneToOne(() => CodigoQR, (codigo_qr) => codigo_qr.parcela)
  codigo_qr: CodigoQR | null;
}
