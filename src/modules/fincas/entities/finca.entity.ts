import {
  Column,
  Entity,
  OneToMany,
  PrimaryGeneratedColumn,
} from 'typeorm';
import { UsuarioFinca } from './usuario-finca.entity';
import { InvitacionFinca } from './invitacion-finca.entity';

@Entity('fincas')
export class Finca {
  @PrimaryGeneratedColumn({ name: 'id_finca', type: 'bigint' })
  id_finca: number;

  @Column({ name: 'nombre_finca' })
  nombre_finca: string;

  @Column({ name: 'ubicacion_finca', nullable: true })
  ubicacion_finca: string | null;

  @Column({
    name: 'superficie_finca',
    type: 'double precision',
    nullable: true,
  })
  superficie_finca: number | null;

  @Column({ name: 'descripcion_finca', nullable: true })
  descripcion_finca: string | null;

  @Column({
    name: 'fecha_alta_finca',
    type: 'timestamptz',
    default: () => 'CURRENT_TIMESTAMP',
  })
  fecha_alta_finca: Date;

  @Column({ name: 'fecha_baja_finca', type: 'timestamptz', nullable: true })
  fecha_baja_finca: Date | null;

  @OneToMany(() => UsuarioFinca, (uf) => uf.finca)
  usuario_fincas: UsuarioFinca[];

  @OneToMany(() => InvitacionFinca, (i) => i.finca)
  invitaciones: InvitacionFinca[];
}
