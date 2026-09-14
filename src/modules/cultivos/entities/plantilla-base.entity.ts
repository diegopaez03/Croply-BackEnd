import {
  Column,
  Entity,
  OneToMany,
  PrimaryGeneratedColumn,
} from 'typeorm';
import { PlantillaCultivoVariedad } from './plantilla-cultivo-variedad.entity';
import { HitoPlantilla } from './hito-plantilla.entity';

@Entity('plantillas_base')
export class PlantillaBase {
  @PrimaryGeneratedColumn({ name: 'id_plantilla_base', type: 'bigint' })
  id_plantilla_base: number;

  @Column({ name: 'nombre_pb' })
  nombre_pb: string;

  @Column({
    name: 'fecha_alta_pb',
    type: 'timestamptz',
    default: () => 'CURRENT_TIMESTAMP',
  })
  fecha_alta_pb: Date;

  @Column({ name: 'fecha_baja_pb', type: 'timestamptz', nullable: true })
  fecha_baja_pb: Date | null;

  @OneToMany(() => PlantillaCultivoVariedad, (pcv) => pcv.plantilla_base)
  plantilla_cultivo_variedades: PlantillaCultivoVariedad[];

  @OneToMany(() => HitoPlantilla, (h) => h.plantilla_base)
  hitos: HitoPlantilla[];
}
