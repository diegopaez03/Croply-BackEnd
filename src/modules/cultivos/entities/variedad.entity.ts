import {
  Column,
  Entity,
  JoinColumn,
  ManyToOne,
  OneToMany,
  PrimaryGeneratedColumn,
} from 'typeorm';
import { CultivoBase } from './cultivo-base.entity';
import { PlantillaCultivoVariedad } from './plantilla-cultivo-variedad.entity';

@Entity('variedades')
export class Variedad {
  @PrimaryGeneratedColumn({ name: 'id_variedad', type: 'bigint' })
  id_variedad: number;

  @Column({ name: 'nombre_variedad' })
  nombre_variedad: string;

  @Column({ name: 'distancia_plantacion' })
  distancia_plantacion: string;

  @Column({ name: 'observaciones', type: 'text', nullable: true })
  observaciones: string | null;

  @Column({ name: 'dias_a_cosecha', type: 'int' })
  dias_a_cosecha: number;

  @Column({
    name: 'fecha_alta',
    type: 'timestamptz',
    default: () => 'CURRENT_TIMESTAMP',
  })
  fecha_alta: Date;

  @Column({ name: 'fecha_baja', type: 'timestamptz', nullable: true })
  fecha_baja: Date | null;

  @ManyToOne(() => CultivoBase, (c) => c.variedades, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'id_cultivo_base' })
  cultivo_base: CultivoBase;

  @OneToMany(() => PlantillaCultivoVariedad, (pcv) => pcv.variedad)
  plantilla_cultivo_variedades: PlantillaCultivoVariedad[];
}
