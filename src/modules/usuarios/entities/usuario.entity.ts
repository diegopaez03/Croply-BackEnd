import {
  Column,
  CreateDateColumn,
  Entity,
  JoinColumn,
  ManyToOne,
  OneToMany,
  PrimaryGeneratedColumn,
} from 'typeorm';
import { EstadoUsuario } from '../../../common/enums';
import { RolSistema } from '../../roles/entities/rol.entity';
import { UsuarioFinca } from '../../fincas/entities/usuario-finca.entity';
import { ResetsContrasena } from '../../auth/entities/resets-contrasena.entity';
import { InvitacionFinca } from '../../fincas/entities/invitacion-finca.entity';
import { SolicitudDigitalizacionFinca } from '../../solicitudes-digitalizacion/entities/solicitud-digitalizacion-finca.entity';

@Entity('usuarios')
export class Usuario {
  @PrimaryGeneratedColumn({ name: 'id_usuario', type: 'bigint' })
  id_usuario: number;

  @Column({ unique: true })
  email: string;

  @Column()
  contrasena: string;

  @Column({ type: 'enum', enum: EstadoUsuario, default: EstadoUsuario.PENDIENTE })
  estado: EstadoUsuario;

  @Column()
  nombre: string;

  @Column()
  apellido: string;

  @Column({ nullable: true })
  telefono: string | null;

  @Column({ name: 'debe_cambiar_contrasena', default: false })
  debe_cambiar_contrasena: boolean;

  @CreateDateColumn({ name: 'fecha_alta', type: 'timestamptz' })
  fecha_alta: Date;

  @Column({ name: 'fecha_baja', type: 'timestamptz', nullable: true })
  fecha_baja: Date | null;

  @ManyToOne(() => RolSistema, { nullable: true, eager: true })
  @JoinColumn({ name: 'id_rol_sistema' })
  rol_sistema: RolSistema | null;

  @OneToMany(() => UsuarioFinca, (uf) => uf.usuario)
  usuario_fincas: UsuarioFinca[];

  @OneToMany(() => ResetsContrasena, (r) => r.usuario)
  resets_contrasena: ResetsContrasena[];

  @OneToMany(() => InvitacionFinca, (i) => i.invitado_por)
  invitaciones_enviadas: InvitacionFinca[];

  @OneToMany(() => SolicitudDigitalizacionFinca, (s) => s.usuario)
  solicitudes_digitalizacion: SolicitudDigitalizacionFinca[];
}
