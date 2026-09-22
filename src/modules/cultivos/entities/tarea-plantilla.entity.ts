import {
  Column,
  Entity,
  JoinColumn,
  ManyToOne,
  PrimaryGeneratedColumn,
} from 'typeorm';
import { HitoPlantilla } from './hito-plantilla.entity';
import { TipoTarea } from '../../tipos-tarea/entities/tipo-tarea.entity';

@Entity('tareas_plantilla')
export class TareaPlantilla {
  @PrimaryGeneratedColumn({ name: 'id_tarea_plantilla', type: 'bigint' })
  id_tarea_plantilla: number;

  @Column({ name: 'dia_relativo_tp', type: 'int' })
  dia_relativo_tp: number;

  @ManyToOne(() => TipoTarea, { nullable: false })
  @JoinColumn({ name: 'id_tipo_tarea' })
  tipo_tarea: TipoTarea;

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
