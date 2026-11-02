import {
  Column,
  Entity,
  JoinColumn,
  ManyToOne,
  PrimaryGeneratedColumn,
} from 'typeorm';
import { Tarea } from '../../planes-accion/entities/tarea.entity';
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

  @Column({ name: 'fecha_lectura', type: 'timestamptz', nullable: true })
  fecha_lectura: Date | null;

  @Column({
    name: 'fecha_creacion',
    type: 'timestamptz',
    default: () => 'CURRENT_TIMESTAMP',
  })
  fecha_creacion: Date;

  @ManyToOne(() => Usuario, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'id_usuario' })
  usuario: Usuario;

  @ManyToOne(() => AlertaClimatica, { nullable: true, onDelete: 'CASCADE' })
  @JoinColumn({ name: 'id_alerta' })
  alerta: AlertaClimatica | null;

  @ManyToOne(() => Tarea, { nullable: true, onDelete: 'SET NULL' })
  @JoinColumn({ name: 'id_tarea' })
  tarea: Tarea | null;
}
