import {
  Column,
  Entity,
  JoinColumn,
  ManyToOne,
  PrimaryGeneratedColumn,
} from 'typeorm';
import { Finca } from '../../fincas/entities/finca.entity';
import { EstadoAlertaClimatica } from '../enums/estado-alerta-climatica.enum';

@Entity('alertas_climaticas')
export class AlertaClimatica {
  @PrimaryGeneratedColumn({ name: 'id_alerta', type: 'bigint' })
  id_alerta: number;

  @Column({ name: 'codigo_alerta' })
  codigo_alerta: string;

  @Column()
  severidad: string;

  @Column({ type: 'text' })
  descripcion: string;

  @Column({ name: 'fecha_deteccion', type: 'timestamptz' })
  fecha_deteccion: Date;

  @Column({ type: 'enum', enum: EstadoAlertaClimatica })
  estado: EstadoAlertaClimatica;

  @Column({ name: 'fecha_resolucion', type: 'timestamptz', nullable: true })
  fecha_resolucion: Date | null;

  @ManyToOne(() => Finca, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'id_finca' })
  finca: Finca;
}
