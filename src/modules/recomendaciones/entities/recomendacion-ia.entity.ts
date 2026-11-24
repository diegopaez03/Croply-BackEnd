import {
  Column,
  Entity,
  JoinColumn,
  ManyToOne,
  PrimaryGeneratedColumn,
} from 'typeorm';
import { Parcela } from '../../parcelas/entities/parcela.entity';

export interface FactorClave {
  sensor_ui: string;
  valor: number | null;
}

@Entity('recomendaciones_ia')
export class RecomendacionIa {
  @PrimaryGeneratedColumn({ name: 'id_recomendacion', type: 'bigint' })
  id_recomendacion: number;

  @Column({ name: 'accion_recomendada' })
  accion_recomendada: string;

  @Column()
  severidad: string;

  @Column({ name: 'sensor_origen_principal' })
  sensor_origen_principal: string;

  @Column({
    name: 'factores_clave',
    type: 'jsonb',
    default: () => "'[]'",
  })
  factores_clave: FactorClave[];

  @Column({ name: 'titulo_corto', type: 'varchar', nullable: true })
  titulo_corto: string | null;

  @Column({ name: 'texto_breve', type: 'varchar', nullable: true })
  texto_breve: string | null;

  @Column({ name: 'texto_explicativo_extendido', type: 'text', nullable: true })
  texto_explicativo_extendido: string | null;

  @Column({ name: 'fecha_generacion', type: 'timestamptz' })
  fecha_generacion: Date;

  @Column({ name: 'valida_hasta', type: 'timestamptz' })
  valida_hasta: Date;

  @Column({ name: 'fuente_generacion' })
  fuente_generacion: string;

  @ManyToOne(() => Parcela, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'id_parcela' })
  parcela: Parcela;
}
