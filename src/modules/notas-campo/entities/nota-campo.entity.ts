import {
  Column,
  Entity,
  JoinColumn,
  ManyToOne,
  PrimaryGeneratedColumn,
} from 'typeorm';
import { UsuarioFinca } from '../../fincas/entities/usuario-finca.entity';
import { Tarea } from '../../planes-accion/entities/tarea.entity';
import { Parcela } from '../../parcelas/entities/parcela.entity';

export enum EstadoNotaCampo {
  SINCRONIZADA = 'Sincronizada',
  CONVERTIDA_A_TAREA = 'Convertida_a_tarea',
}

@Entity('notas_campo')
export class NotaCampo {
  @PrimaryGeneratedColumn({ name: 'id_nota_campo', type: 'bigint' })
  id_nota_campo: number;

  @Column({ name: 'contenido_nota_campo', type: 'text' })
  contenido_nota_campo: string;

  @Column({ name: 'fecha_captura_nc', type: 'timestamptz' })
  fecha_captura_nc: Date;

  @Column({
    name: 'estado',
    type: 'enum',
    enum: EstadoNotaCampo,
    default: EstadoNotaCampo.SINCRONIZADA,
  })
  estado: EstadoNotaCampo;

  @ManyToOne(() => UsuarioFinca, { nullable: false })
  @JoinColumn({ name: 'id_usuario_finca' })
  usuario_finca: UsuarioFinca;

  @ManyToOne(() => Parcela, { nullable: true, onDelete: 'SET NULL' })
  @JoinColumn({ name: 'id_parcela' })
  parcela: Parcela | null;

  @ManyToOne(() => Tarea, { nullable: true, onDelete: 'SET NULL' })
  @JoinColumn({ name: 'id_tarea' })
  tarea: Tarea | null;
}
