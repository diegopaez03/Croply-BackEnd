import {
  Column,
  Entity,
  OneToMany,
  PrimaryGeneratedColumn,
} from 'typeorm';
import { EpocaCultivo, FormaSiembra } from '../../../common/enums';
import { Variedad } from './variedad.entity';
import { PlantillaCultivoVariedad } from './plantilla-cultivo-variedad.entity';

@Entity('cultivos_base')
export class CultivoBase {
  @PrimaryGeneratedColumn({ name: 'id_cultivo_base', type: 'bigint' })
  id_cultivo_base: number;

  @Column({ name: 'nombre_cultivo_base' })
  nombre_cultivo_base: string;

  @Column({ name: 'descripcion_cb', type: 'text' })
  descripcion_cb: string;

  @Column({
    name: 'epoca_cultivo',
    type: 'enum',
    enum: EpocaCultivo,
  })
  epoca_cultivo: EpocaCultivo;

  @Column({ name: 'mes_siembra' })
  mes_siembra: string;

  @Column({ name: 'ciclo_productivo_cb' })
  ciclo_productivo_cb: string;

  @Column({
    name: 'forma_siembra',
    type: 'enum',
    enum: FormaSiembra,
  })
  forma_siembra: FormaSiembra;

  @Column({
    name: 'fecha_alta_cb',
    type: 'timestamptz',
    default: () => 'CURRENT_TIMESTAMP',
  })
  fecha_alta_cb: Date;

  @Column({ name: 'fecha_baja_cb', type: 'timestamptz', nullable: true })
  fecha_baja_cb: Date | null;

  @OneToMany(() => Variedad, (v) => v.cultivo_base)
  variedades: Variedad[];

  @OneToMany(() => PlantillaCultivoVariedad, (pcv) => pcv.cultivo_base)
  plantilla_cultivo_variedades: PlantillaCultivoVariedad[];
}
