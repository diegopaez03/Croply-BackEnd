import {
  Column,
  Entity,
  JoinColumn,
  ManyToOne,
  PrimaryGeneratedColumn,
} from 'typeorm';
import { Usuario } from '../../usuarios/entities/usuario.entity';

@Entity('resets_contrasena')
export class ResetsContrasena {
  @PrimaryGeneratedColumn({ type: 'bigint' })
  id: number;

  @Column({ name: 'token_hash' })
  token_hash: string;

  @Column({ name: 'fecha_fin_vigencia', type: 'timestamptz' })
  fecha_fin_vigencia: Date;

  @Column({ name: 'fecha_uso', type: 'timestamptz', nullable: true })
  fecha_uso: Date | null;

  @Column({
    name: 'fecha_alta',
    type: 'timestamptz',
    default: () => 'CURRENT_TIMESTAMP',
  })
  fecha_alta: Date;

  @ManyToOne(() => Usuario, (u) => u.resets_contrasena, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'id_usuario' })
  usuario: Usuario;
}
