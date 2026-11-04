import { Column, Entity, PrimaryGeneratedColumn } from 'typeorm';

@Entity('preguntas_frecuentes')
export class PreguntaFrecuente {
  @PrimaryGeneratedColumn({ name: 'id_pregunta_frecuente', type: 'bigint' })
  id_pregunta_frecuente: number;

  @Column({ name: 'pregunta', type: 'varchar', length: 255 })
  pregunta: string;

  @Column({ name: 'respuesta', type: 'text' })
  respuesta: string;

  @Column({
    name: 'fecha_alta_pf',
    type: 'timestamptz',
    default: () => 'CURRENT_TIMESTAMP',
  })
  fecha_alta_pf: Date;

  @Column({ name: 'fecha_baja_pf', type: 'timestamptz', nullable: true })
  fecha_baja_pf: Date | null;
}
