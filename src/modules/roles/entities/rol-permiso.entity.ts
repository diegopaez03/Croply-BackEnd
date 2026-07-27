import {
  Entity,
  JoinColumn,
  ManyToOne,
  PrimaryGeneratedColumn,
  Unique,
} from 'typeorm';
import { Rol } from './rol.entity';
import { Permiso } from './permiso.entity';

@Entity('rol_permiso')
@Unique(['rol', 'permiso'])
export class RolPermiso {
  @PrimaryGeneratedColumn({ name: 'id_rol_permiso', type: 'bigint' })
  id_rol_permiso: number;

  @ManyToOne(() => Rol, (r) => r.rol_permisos, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'id_rol' })
  rol: Rol;

  @ManyToOne(() => Permiso, (p) => p.rol_permisos, {
    onDelete: 'CASCADE',
    eager: true,
  })
  @JoinColumn({ name: 'id_permiso' })
  permiso: Permiso;
}
