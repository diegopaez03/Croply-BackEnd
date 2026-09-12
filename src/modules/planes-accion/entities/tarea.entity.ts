import {
  Column,
  Entity,
  JoinColumn,
  ManyToOne,
  PrimaryGeneratedColumn,
} from 'typeorm';
import { Hito } from './hito.entity';

@Entity('tareas')
export class Tarea {
  @PrimaryGeneratedColumn({ name: 'id_tarea', type: 'bigint' })
  id_tarea: number;

  @Column({ name: 'dia_relativo_tarea', type: 'int' })
  dia_relativo_tarea: number;

  @Column({ name: 'id_tipo_tarea', type: 'int' })
  id_tipo_tarea: number;

  @Column({ name: 'descripcion_tarea', type: 'text' })
  descripcion_tarea: string;

  @Column({ name: 'nombre_producto', nullable: true })
  nombre_producto: string | null;

  @Column({ name: 'dosis_aa', nullable: true })
  dosis_aa: string | null;

  @ManyToOne(() => Hito, (hito) => hito.tareas, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'id_hito' })
  hito: Hito;
}
