import { Column, Entity, PrimaryGeneratedColumn } from 'typeorm';

@Entity('estados_tarea')
export class EstadoTarea {
  @PrimaryGeneratedColumn({ name: 'id_estado_tarea', type: 'bigint' })
  id_estado_tarea: number;

  @Column({ name: 'nombre_estado_tarea' })
  nombre_estado_tarea: string;

  @Column({
    name: 'fecha_alta_estado_tarea',
    type: 'timestamptz',
    default: () => 'CURRENT_TIMESTAMP',
  })
  fecha_alta_estado_tarea: Date;

  @Column({
    name: 'fecha_baja_estado_tarea',
    type: 'timestamptz',
    nullable: true,
  })
  fecha_baja_estado_tarea: Date | null;

  @Column({ name: 'protegido', type: 'boolean', default: false })
  protegido: boolean;

  @Column({ name: 'es_estado_finalizador', type: 'boolean', default: false })
  es_estado_finalizador: boolean;

  @Column({
    name: 'cuenta_para_cierre_exitoso',
    type: 'boolean',
    default: false,
  })
  cuenta_para_cierre_exitoso: boolean;
}
