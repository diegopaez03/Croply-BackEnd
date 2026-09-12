import {
  Column,
  Entity,
  JoinColumn,
  ManyToOne,
  OneToMany,
  PrimaryGeneratedColumn,
} from 'typeorm';
import { EstadoPlanAccion } from '../../../common/enums';
import { CultivoBase } from '../../cultivos/entities/cultivo-base.entity';
import { Variedad } from '../../cultivos/entities/variedad.entity';
import { Parcela } from '../../parcelas/entities/parcela.entity';
import { Hito } from './hito.entity';

@Entity('planes_accion')
export class PlanAccion {
  @PrimaryGeneratedColumn({ name: 'id_plan_accion', type: 'bigint' })
  id_plan_accion: number;

  @Column({ name: 'superficie_ocupada_pa', type: 'double precision' })
  superficie_ocupada_pa: number;

  @Column({ name: 'fecha_inicio_pa', type: 'date' })
  fecha_inicio_pa: string;

  @Column({ name: 'fecha_fin_pa', type: 'date', nullable: true })
  fecha_fin_pa: string | null;

  @Column({ type: 'enum', enum: EstadoPlanAccion, default: EstadoPlanAccion.ACTIVO })
  estado: EstadoPlanAccion;

  @ManyToOne(() => Parcela, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'id_parcela' })
  parcela: Parcela;

  @ManyToOne(() => CultivoBase, { onDelete: 'RESTRICT' })
  @JoinColumn({ name: 'id_cultivo_base' })
  cultivo_base: CultivoBase;

  @ManyToOne(() => Variedad, { onDelete: 'RESTRICT' })
  @JoinColumn({ name: 'id_variedad' })
  variedad: Variedad;

  @OneToMany(() => Hito, (hito) => hito.plan_accion)
  hitos: Hito[];
}
