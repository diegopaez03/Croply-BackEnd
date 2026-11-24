import { Column, Entity, PrimaryGeneratedColumn } from 'typeorm';

@Entity('tipos_tarea')
export class TipoTarea {
  @PrimaryGeneratedColumn({ name: 'id_tipo_tarea', type: 'bigint' })
  id_tipo_tarea: number;

  @Column({ name: 'nombre_tipo_tarea' })
  nombre_tipo_tarea: string;

  @Column({
    name: 'fecha_alta_tipo_tarea',
    type: 'timestamptz',
    default: () => 'CURRENT_TIMESTAMP',
  })
  fecha_alta_tipo_tarea: Date;

  @Column({ name: 'fecha_baja_tipo_tarea', type: 'timestamptz', nullable: true })
  fecha_baja_tipo_tarea: Date | null;

  @Column({ name: 'protegido', type: 'boolean', default: false })
  protegido: boolean;

  @Column({ name: 'es_tipo_agroquimico', type: 'boolean', default: false })
  es_tipo_agroquimico: boolean;
}
