import {
  Column,
  Entity,
  JoinColumn,
  ManyToOne,
  PrimaryGeneratedColumn,
} from 'typeorm';
import { EstadoInvitacion } from '../../../common/enums';
import { Usuario } from '../../usuarios/entities/usuario.entity';
import { Finca } from './finca.entity';
import { RolFinca } from '../../roles/entities/rol.entity';

@Entity('invitaciones_finca')
export class InvitacionFinca {
  @PrimaryGeneratedColumn({ name: 'id_invitacion_finca', type: 'bigint' })
  id_invitacion_finca: number;

  @Column({ name: 'email_invitado' })
  email_invitado: string;

  @Column({ name: 'token_hash' })
  token_hash: string;

  @Column({ name: 'fecha_envio', type: 'timestamptz', default: () => 'CURRENT_TIMESTAMP' })
  fecha_envio: Date;

  @Column({ name: 'fecha_fin_vigencia', type: 'timestamptz' })
  fecha_fin_vigencia: Date;

  @Column({ name: 'fecha_respuesta', type: 'timestamptz', nullable: true })
  fecha_respuesta: Date | null;

  @Column({
    type: 'enum',
    enum: EstadoInvitacion,
    default: EstadoInvitacion.PENDIENTE,
  })
  estado: EstadoInvitacion;

  @ManyToOne(() => Finca, (f) => f.invitaciones, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'id_finca' })
  finca: Finca;

  @ManyToOne(() => RolFinca, { eager: true })
  @JoinColumn({ name: 'id_rol_finca' })
  rol_finca: RolFinca;

  @ManyToOne(() => Usuario, (u) => u.invitaciones_enviadas, { nullable: true })
  @JoinColumn({ name: 'id_invitado_por' })
  invitado_por: Usuario | null;

  @ManyToOne(() => Usuario, { nullable: true })
  @JoinColumn({ name: 'id_usuario_registrado' })
  usuario_registrado: Usuario | null;
}
