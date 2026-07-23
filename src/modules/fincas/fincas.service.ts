import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { IsNull, MoreThan, Repository } from 'typeorm';
import { EstadoInvitacion } from '../../common/enums';
import { Finca } from './entities/finca.entity';
import { InvitacionFinca } from './entities/invitacion-finca.entity';
import { UsuarioFinca } from './entities/usuario-finca.entity';
import { Usuario } from '../usuarios/entities/usuario.entity';
import { RolFinca } from '../roles/entities/rol.entity';

@Injectable()
export class FincasService {
  constructor(
    @InjectRepository(Finca)
    private readonly finca_repo: Repository<Finca>,
    @InjectRepository(UsuarioFinca)
    private readonly usuario_finca_repo: Repository<UsuarioFinca>,
    @InjectRepository(InvitacionFinca)
    private readonly invitacion_repo: Repository<InvitacionFinca>,
  ) {}

  async find_invitacion_by_id(
    id_invitacion_finca: number,
  ): Promise<InvitacionFinca | null> {
    return this.invitacion_repo.findOne({
      where: { id_invitacion_finca },
      relations: ['finca', 'rol_finca', 'usuario_registrado'],
    });
  }

  async find_all_invitaciones(): Promise<InvitacionFinca[]> {
    return this.invitacion_repo.find({
      relations: ['finca', 'rol_finca', 'usuario_registrado'],
    });
  }

  async find_pending_invitaciones(): Promise<InvitacionFinca[]> {
    return this.invitacion_repo.find({
      where: {
        estado: EstadoInvitacion.PENDIENTE,
        fecha_fin_vigencia: MoreThan(new Date()),
        fecha_respuesta: IsNull(),
      },
      relations: ['finca', 'rol_finca'],
    });
  }

  async save_invitacion(invitacion: InvitacionFinca): Promise<InvitacionFinca> {
    return this.invitacion_repo.save(invitacion);
  }

  async create_usuario_finca(params: {
    usuario: Usuario;
    finca: Finca;
    rol_finca: RolFinca;
  }): Promise<UsuarioFinca> {
    const uf = this.usuario_finca_repo.create({
      usuario: params.usuario,
      finca: params.finca,
      rol_finca: params.rol_finca,
    });
    return this.usuario_finca_repo.save(uf);
  }
}
