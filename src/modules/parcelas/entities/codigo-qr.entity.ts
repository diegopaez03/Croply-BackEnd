import {
  Column,
  Entity,
  JoinColumn,
  OneToOne,
  PrimaryGeneratedColumn,
} from 'typeorm';
import { Parcela } from './parcela.entity';

@Entity('codigos_qr')
export class CodigoQR {
  @PrimaryGeneratedColumn({ name: 'id_codigo_qr', type: 'bigint' })
  id_codigo_qr: number;

  @Column({ name: 'codigo_qr', unique: true })
  codigo_qr: string;

  @Column({ name: 'url_acceso_qr' })
  url_acceso_qr: string;

  @Column({ name: 'fecha_generacion_qr', type: 'timestamptz' })
  fecha_generacion_qr: Date;

  @OneToOne(() => Parcela, (parcela) => parcela.codigo_qr, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'id_parcela' })
  parcela: Parcela;
}
