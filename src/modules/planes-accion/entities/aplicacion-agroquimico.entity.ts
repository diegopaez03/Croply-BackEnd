import {
  Column,
  CreateDateColumn,
  Entity,
  JoinColumn,
  ManyToOne,
  OneToOne,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from 'typeorm';
import { UsuarioFinca } from '../../fincas/entities/usuario-finca.entity';
import { Parcela } from '../../parcelas/entities/parcela.entity';
import { Tarea } from './tarea.entity';

@Entity('aplicaciones_agroquimico')
export class AplicacionAgroquimico {
  @PrimaryGeneratedColumn({
    name: 'id_aplicacion_agroquimico',
    type: 'bigint',
  })
  id_aplicacion_agroquimico: number;

  @Column({ name: 'nombre_producto_aa', nullable: true })
  nombre_producto_aa: string | null;

  @Column({ name: 'dosis_aa', nullable: true })
  dosis_aa: string | null;

  @Column({
    name: 'fecha_hora_aplicacion_aa',
    type: 'timestamptz',
    nullable: true,
  })
  fecha_hora_aplicacion_aa: Date | null;

  @Column({ name: 'observaciones', type: 'text', nullable: true })
  observaciones: string | null;

  @CreateDateColumn({ name: 'fecha_creacion', type: 'timestamptz' })
  fecha_creacion: Date;

  @UpdateDateColumn({ name: 'fecha_modificacion', type: 'timestamptz' })
  fecha_modificacion: Date;

  @OneToOne(() => Tarea, { nullable: true, onDelete: 'CASCADE' })
  @JoinColumn({ name: 'id_tarea' })
  tarea: Tarea | null;

  @ManyToOne(() => UsuarioFinca, { nullable: true, onDelete: 'SET NULL' })
  @JoinColumn({ name: 'id_responsable' })
  responsable: UsuarioFinca | null;

  @ManyToOne(() => Parcela, { nullable: true, onDelete: 'CASCADE' })
  @JoinColumn({ name: 'id_parcela' })
  parcela: Parcela | null;
}
