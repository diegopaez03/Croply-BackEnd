import {
  Column,
  CreateDateColumn,
  Entity,
  JoinColumn,
  ManyToOne,
  PrimaryGeneratedColumn,
} from 'typeorm';
import { EstadoTarea } from '../../../common/enums';
import { UsuarioFinca } from '../../fincas/entities/usuario-finca.entity';
import { Hito } from './hito.entity';

@Entity('tareas')
export class Tarea {
  @PrimaryGeneratedColumn({ name: 'id_tarea', type: 'bigint' })
  id_tarea: number;

  @Column({ name: 'nombre_tarea' })
  nombre_tarea: string;

  @Column({ name: 'descripcion_tarea', type: 'text' })
  descripcion_tarea: string;

  @Column({ name: 'fecha_planificada_tarea', type: 'date' })
  fecha_planificada_tarea: string;

  @Column({ name: 'fecha_ejecucion_tarea', type: 'timestamptz', nullable: true })
  fecha_ejecucion_tarea: Date | null;

  @CreateDateColumn({ name: 'fecha_creacion_tarea', type: 'timestamptz' })
  fecha_creacion_tarea: Date;

  @Column({ name: 'id_tipo_tarea', type: 'int' })
  id_tipo_tarea: number;

  @Column({
    name: 'estado',
    type: 'enum',
    enum: EstadoTarea,
    default: EstadoTarea.PLANIFICADO,
  })
  estado: EstadoTarea;

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

  @Column({ name: 'dia_relativo_tarea', type: 'int', nullable: true })
  dia_relativo_tarea: number | null;

  @ManyToOne(() => UsuarioFinca, { nullable: true, onDelete: 'SET NULL' })
  @JoinColumn({ name: 'id_responsable' })
  responsable: UsuarioFinca | null;

  @ManyToOne(() => Hito, (hito) => hito.tareas, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'id_hito' })
  hito: Hito;
}
