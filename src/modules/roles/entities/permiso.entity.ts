import { Column, Entity, OneToMany, PrimaryGeneratedColumn } from 'typeorm';
import { AmbitoPermiso } from '../../../common/enums';
import { RolPermiso } from './rol-permiso.entity';

@Entity('permisos')
export class Permiso {
  @PrimaryGeneratedColumn({ name: 'id_permiso', type: 'bigint' })
  id_permiso: number;

  @Column({ name: 'nombre_permiso' })
  nombre_permiso: string;

  @Column({ type: 'enum', enum: AmbitoPermiso })
  ambito: AmbitoPermiso;

  @OneToMany(() => RolPermiso, (rp) => rp.permiso)
  rol_permisos: RolPermiso[];
}
