import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Usuario } from './entities/usuario.entity';

@Injectable()
export class UsuariosService {
  constructor(
    @InjectRepository(Usuario)
    private readonly usuario_repo: Repository<Usuario>,
  ) {}

  async find_by_email(email: string): Promise<Usuario | null> {
    return this.usuario_repo.findOne({
      where: { email: email.toLowerCase() },
      relations: [
        'rol_sistema',
        'usuario_fincas',
        'usuario_fincas.finca',
        'usuario_fincas.rol_finca',
      ],
    });
  }

  async find_by_id(id_usuario: number): Promise<Usuario | null> {
    return this.usuario_repo.findOne({
      where: { id_usuario },
      relations: [
        'rol_sistema',
        'usuario_fincas',
        'usuario_fincas.finca',
        'usuario_fincas.rol_finca',
      ],
    });
  }

  async create(data: Partial<Usuario>): Promise<Usuario> {
    const usuario = this.usuario_repo.create({
      ...data,
      email: data.email?.toLowerCase(),
    });
    return this.usuario_repo.save(usuario);
  }

  async save(usuario: Usuario): Promise<Usuario> {
    return this.usuario_repo.save(usuario);
  }

  async exists_by_email(email: string): Promise<boolean> {
    const count = await this.usuario_repo.count({
      where: { email: email.toLowerCase() },
    });
    return count > 0;
  }
}
