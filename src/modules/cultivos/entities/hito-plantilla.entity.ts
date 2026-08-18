import {
  Column,
  Entity,
  JoinColumn,
  ManyToOne,
  OneToMany,
  PrimaryGeneratedColumn,
} from 'typeorm';
import { PlantillaBase } from './plantilla-base.entity';
import { TareaPlantilla } from './tarea-plantilla.entity';

@Entity('hitos_plantilla')
export class HitoPlantilla {
  @PrimaryGeneratedColumn({ name: 'id_hito_plantilla', type: 'bigint' })
  id_hito_plantilla: number;

  @Column({ name: 'nombre_hpb' })
  nombre_hpb: string;

  @Column({ name: 'orden_hpb', type: 'int' })
  orden_hpb: number;

  @ManyToOne(() => PlantillaBase, (p) => p.hitos, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'id_plantilla_base' })
  plantilla_base: PlantillaBase;

  @OneToMany(() => TareaPlantilla, (t) => t.hito_plantilla)
  tareas: TareaPlantilla[];
}
