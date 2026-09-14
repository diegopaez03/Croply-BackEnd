import {
  Column,
  Entity,
  JoinColumn,
  ManyToOne,
  PrimaryGeneratedColumn,
} from 'typeorm';
import { HitoPlantilla } from './hito-plantilla.entity';

@Entity('tareas_plantilla')
export class TareaPlantilla {
  @PrimaryGeneratedColumn({ name: 'id_tarea_plantilla', type: 'bigint' })
  id_tarea_plantilla: number;

  @Column({ name: 'dia_relativo_tp', type: 'int' })
  dia_relativo_tp: number;

  @Column({ name: 'id_tipo_tarea', type: 'int' })
  id_tipo_tarea: number;

  @Column({ name: 'descripcion_tp', type: 'text' })
  descripcion_tp: string;

  @Column({ name: 'nombre_producto', nullable: true })
  nombre_producto: string | null;

  @Column({ name: 'dosis_aa', nullable: true })
  dosis_aa: string | null;

  @ManyToOne(() => HitoPlantilla, (h) => h.tareas, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'id_hito_plantilla' })
  hito_plantilla: HitoPlantilla;
}
