import {
  ChildEntity,
  Column,
  Entity,
  PrimaryGeneratedColumn,
  TableInheritance,
} from 'typeorm';
import { TipoRol } from '../../../common/enums';

@Entity('roles')
@TableInheritance({ column: { type: 'varchar', name: 'tipo', default: TipoRol.SISTEMA } })
export abstract class Rol {
  @PrimaryGeneratedColumn({ name: 'id_rol', type: 'bigint' })
  id_rol: number;

  @Column({ name: 'nombre_rol' })
  nombre_rol: string;

  @Column({ name: 'fecha_alta_rol', type: 'timestamptz', default: () => 'CURRENT_TIMESTAMP' })
  fecha_alta_rol: Date;

  @Column({ name: 'fecha_baja_rol', type: 'timestamptz', nullable: true })
  fecha_baja_rol: Date | null;
}

@ChildEntity(TipoRol.SISTEMA)
export class RolSistema extends Rol {
  @Column({ unique: true })
  codigo: string;
}

@ChildEntity(TipoRol.FINCA)
export class RolFinca extends Rol {
  @Column({ name: 'codigo_rol_finca', unique: true })
  codigo_rol_finca: string;
}
