import {
  Column,
  CreateDateColumn,
  Entity,
  JoinColumn,
  ManyToOne,
  PrimaryGeneratedColumn,
} from 'typeorm';
import { TipoOperacion } from '../../../common/enums';
import { Usuario } from '../../usuarios/entities/usuario.entity';

@Entity('log_operaciones')
export class LogOperaciones {
  @PrimaryGeneratedColumn({ name: 'id_log_operaciones', type: 'bigint' })
  id_log_operaciones: number;

  @Column({
    name: 'tipo_operacion',
    type: 'enum',
    enum: TipoOperacion,
  })
  tipo_operacion: TipoOperacion;

  @Column({ type: 'text' })
  descripcion: string;

  @Column({ nullable: true })
  recurso: string | null;

  @CreateDateColumn({ name: 'fecha', type: 'timestamptz' })
  fecha: Date;

  @ManyToOne(() => Usuario, { nullable: true, onDelete: 'SET NULL' })
  @JoinColumn({ name: 'id_usuario' })
  usuario: Usuario | null;
}
