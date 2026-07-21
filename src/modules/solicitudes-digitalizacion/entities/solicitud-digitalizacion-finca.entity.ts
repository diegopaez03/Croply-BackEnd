import {
  Column,
  Entity,
  JoinColumn,
  ManyToOne,
  PrimaryGeneratedColumn,
} from 'typeorm';
import { EstadoSolicitud } from '../../../common/enums';
import { Usuario } from '../../usuarios/entities/usuario.entity';

@Entity('solicitudes_digitalizacion_finca')
export class SolicitudDigitalizacionFinca {
  @PrimaryGeneratedColumn({ name: 'id_solicitud_df', type: 'bigint' })
  id_solicitud_df: number;

  @Column({ name: 'nombre_completo' })
  nombre_completo: string;

  @Column({ name: 'correo_electronico' })
  correo_electronico: string;

  @Column({ name: 'telefono_contacto' })
  telefono_contacto: string;

  @Column()
  provincia: string;

  @Column()
  departamento: string;

  @Column()
  localidad: string;

  @Column({ name: 'numero_parcelas', type: 'int' })
  numero_parcelas: number;

  @Column({ name: 'superficie_total_hectareas', type: 'double precision' })
  superficie_total_hectareas: number;

  @Column({ name: 'comentario_adicional', nullable: true })
  comentario_adicional: string | null;

  @Column({
    name: 'fecha_solicitud',
    type: 'timestamptz',
    default: () => 'CURRENT_TIMESTAMP',
  })
  fecha_solicitud: Date;

  @Column({
    type: 'enum',
    enum: EstadoSolicitud,
    default: EstadoSolicitud.PENDIENTE,
  })
  estado: EstadoSolicitud;

  @ManyToOne(() => Usuario, (u) => u.solicitudes_digitalizacion, {
    nullable: true,
  })
  @JoinColumn({ name: 'id_usuario' })
  usuario: Usuario | null;
}
