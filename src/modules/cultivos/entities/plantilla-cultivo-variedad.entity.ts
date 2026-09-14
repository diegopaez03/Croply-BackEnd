import {
  Entity,
  JoinColumn,
  ManyToOne,
  PrimaryGeneratedColumn,
} from 'typeorm';
import { PlantillaBase } from './plantilla-base.entity';
import { CultivoBase } from './cultivo-base.entity';
import { Variedad } from './variedad.entity';

@Entity('plantilla_cultivo_variedad')
export class PlantillaCultivoVariedad {
  @PrimaryGeneratedColumn({ name: 'id_pbcv', type: 'bigint' })
  id_pbcv: number;

  @ManyToOne(() => PlantillaBase, (p) => p.plantilla_cultivo_variedades, {
    onDelete: 'CASCADE',
  })
  @JoinColumn({ name: 'id_plantilla_base' })
  plantilla_base: PlantillaBase;

  @ManyToOne(() => CultivoBase, (c) => c.plantilla_cultivo_variedades, {
    onDelete: 'CASCADE',
  })
  @JoinColumn({ name: 'id_cultivo_base' })
  cultivo_base: CultivoBase;

  @ManyToOne(() => Variedad, (v) => v.plantilla_cultivo_variedades, {
    nullable: true,
    onDelete: 'CASCADE',
  })
  @JoinColumn({ name: 'id_variedad' })
  variedad: Variedad | null;
}
