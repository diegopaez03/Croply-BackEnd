import {
  Column,
  Entity,
  JoinColumn,
  ManyToOne,
  PrimaryGeneratedColumn,
} from 'typeorm';
import { Usuario } from '../../usuarios/entities/usuario.entity';
import { TipoNotificacion } from '../enums/tipo-notificacion.enum';
import { AlertaClimatica } from './alerta-climatica.entity';

@Entity('notificaciones')
export class Notificacion {
  @PrimaryGeneratedColumn({ name: 'id_notificacion', type: 'bigint' })
  id_notificacion: number;

  @Column({ type: 'enum', enum: TipoNotificacion })
  tipo: TipoNotificacion;

  @Column()
  titulo: string;

  @Column({ type: 'text' })
  mensaje: string;

  @Column({ default: false })
  leida: boolean;

  @Column({
    name: 'fecha_creacion',
    type: 'timestamptz',
    default: () => 'CURRENT_TIMESTAMP',
  })
  fecha_creacion: Date;

  @ManyToOne(() => Usuario, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'id_usuario' })
  usuario: Usuario;

  @ManyToOne(() => AlertaClimatica, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'id_alerta' })
  alerta: AlertaClimatica;
}
