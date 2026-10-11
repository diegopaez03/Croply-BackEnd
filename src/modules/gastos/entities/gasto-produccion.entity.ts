import {
  Column,
  CreateDateColumn,
  Entity,
  JoinColumn,
  ManyToOne,
  PrimaryGeneratedColumn,
} from 'typeorm';
import { Finca } from '../../fincas/entities/finca.entity';
import { UsuarioFinca } from '../../fincas/entities/usuario-finca.entity';

@Entity('gastos_produccion')
export class GastoProduccion {
  @PrimaryGeneratedColumn({ name: 'id_gasto_produccion', type: 'bigint' })
  id_gasto_produccion: number;

  @Column({ name: 'nombre_insumo_gp', length: 150 })
  nombre_insumo_gp: string;

  @Column({ name: 'monto_gp', type: 'numeric', precision: 12, scale: 2 })
  monto_gp: string;

  @Column({ name: 'fecha_gp', type: 'date' })
  fecha_gp: string;

  @Column({ name: 'nombre_responsable', length: 200 })
  nombre_responsable: string;

  @CreateDateColumn({ name: 'fecha_alta_gp', type: 'timestamptz' })
  fecha_alta_gp: Date;

  @Column({ name: 'fecha_modificacion_gp', type: 'timestamptz', nullable: true })
  fecha_modificacion_gp: Date | null;

  @Column({ name: 'fecha_baja_gp', type: 'timestamptz', nullable: true })
  fecha_baja_gp: Date | null;

  @ManyToOne(() => Finca, { nullable: false })
  @JoinColumn({ name: 'id_finca' })
  finca: Finca;

  @ManyToOne(() => UsuarioFinca, { nullable: false })
  @JoinColumn({ name: 'id_responsable' })
  responsable: UsuarioFinca;
}
