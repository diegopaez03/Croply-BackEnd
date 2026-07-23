import {
  Column,
  Entity,
  JoinColumn,
  ManyToOne,
  PrimaryGeneratedColumn,
} from 'typeorm';
import { Usuario } from '../../usuarios/entities/usuario.entity';
import { Finca } from './finca.entity';
import { RolFinca } from '../../roles/entities/rol.entity';

@Entity('usuario_finca')
export class UsuarioFinca {
  @PrimaryGeneratedColumn({ name: 'id_usuario_finca', type: 'bigint' })
  id_usuario_finca: number;

  @Column({
    name: 'fecha_asociacion_rol',
    type: 'timestamptz',
    default: () => 'CURRENT_TIMESTAMP',
  })
  fecha_asociacion_rol: Date;

  @Column({ name: 'fecha_fin_rol', type: 'timestamptz', nullable: true })
  fecha_fin_rol: Date | null;

  @ManyToOne(() => Usuario, (u) => u.usuario_fincas, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'id_usuario' })
  usuario: Usuario;

  @ManyToOne(() => Finca, (f) => f.usuario_fincas, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'id_finca' })
  finca: Finca;

  @ManyToOne(() => RolFinca, { eager: true })
  @JoinColumn({ name: 'id_rol_finca' })
  rol_finca: RolFinca;
}
