import {
  Column,
  Entity,
  JoinColumn,
  ManyToOne,
  OneToMany,
  PrimaryGeneratedColumn,
} from 'typeorm';
import { PlanAccion } from './plan-accion.entity';
import { Tarea } from './tarea.entity';

@Entity('hitos')
export class Hito {
  @PrimaryGeneratedColumn({ name: 'id_hito', type: 'bigint' })
  id_hito: number;

  @Column({ name: 'nombre_hito' })
  nombre_hito: string;

  @Column({ name: 'orden_hito', type: 'int' })
  orden_hito: number;

  @ManyToOne(() => PlanAccion, (plan) => plan.hitos, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'id_plan_accion' })
  plan_accion: PlanAccion;

  @OneToMany(() => Tarea, (tarea) => tarea.hito)
  tareas: Tarea[];
}
