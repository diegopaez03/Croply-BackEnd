import { HttpStatus, Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, SelectQueryBuilder } from 'typeorm';
import {
  CODIGO_ADMIN_CROPLY,
  CODIGO_ADMIN_FINCA,
  EstadoUsuario,
  TipoOperacion,
} from '../../common/enums';
import {
  DomainException,
  resourceNotFound,
} from '../../common/exceptions';
import { build_page_size_pagination } from '../../common/dto';
import { LogOperacionesService } from '../log-operaciones';
import { RolesService } from '../roles/roles.service';
import { FincasService } from '../fincas/fincas.service';
import { Usuario } from './entities/usuario.entity';
import {
  ActualizarEstadoUsuarioDto,
  ActualizarPerfilDto,
  ListarUsuariosQueryDto,
} from './dto/usuarios.dto';

@Injectable()
export class UsuariosService {
  constructor(
    @InjectRepository(Usuario)
    private readonly usuario_repo: Repository<Usuario>,
    private readonly roles_service: RolesService,
    private readonly fincas_service: FincasService,
    private readonly log_service: LogOperacionesService,
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
      token_version: data.token_version ?? 0,
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

  async get_me(usuario: Usuario) {
    return {
      id_usuario: Number(usuario.id_usuario),
      nombre: usuario.nombre,
      apellido: usuario.apellido,
      email: usuario.email,
      telefono: usuario.telefono,
    };
  }

  async update_me(usuario: Usuario, dto: ActualizarPerfilDto) {
    usuario.nombre = dto.nombre.trim();
    usuario.apellido = dto.apellido.trim();
    if (dto.telefono !== undefined) {
      usuario.telefono = dto.telefono;
    }
    await this.save(usuario);

    await this.log_service.registrar({
      usuario,
      tipo_operacion: TipoOperacion.EXITO,
      descripcion: 'Actualización de perfil propio',
      recurso: `Usuario:${usuario.id_usuario}`,
    });

    return {
      message: 'Perfil actualizado correctamente.',
      ...(await this.get_me(usuario)),
    };
  }

  async asignar_rol_sistema(
    id_usuario: number,
    id_rol: number,
    actor: Usuario,
  ) {
    const usuario = await this.find_by_id(id_usuario);
    if (!usuario) {
      throw resourceNotFound();
    }

    const rol = await this.roles_service.find_rol_sistema_by_id(id_rol);
    if (!rol || rol.fecha_baja_rol != null) {
      throw resourceNotFound();
    }

    usuario.rol_sistema = rol;
    await this.save(usuario);

    await this.log_service.registrar({
      usuario: actor,
      tipo_operacion: TipoOperacion.EXITO,
      descripcion: `Asignación de rol de sistema ${rol.nombre_rol} a usuario ${usuario.email}`,
      recurso: `Usuario:${usuario.id_usuario}`,
    });

    return {
      message: 'Rol de sistema asignado correctamente.',
      id_usuario: Number(usuario.id_usuario),
      id_rol: Number(rol.id_rol),
      nombre_rol: rol.nombre_rol,
    };
  }

  async actualizar_estado(
    id_usuario: number,
    dto: ActualizarEstadoUsuarioDto,
    actor: Usuario,
  ) {
    const usuario = await this.find_by_id(id_usuario);
    if (!usuario) {
      throw resourceNotFound();
    }

    const actor_es_admin_croply =
      actor.rol_sistema?.codigo === CODIGO_ADMIN_CROPLY;
    const actor_es_admin_finca = this.es_admin_finca_de_usuario(actor, usuario);

    if (!actor_es_admin_croply && !actor_es_admin_finca) {
      throw new DomainException(
        'FORBIDDEN',
        'No tenés permisos para realizar esta acción',
        HttpStatus.FORBIDDEN,
      );
    }

    if (!actor_es_admin_croply && dto.estado === EstadoUsuario.PENDIENTE) {
      throw new DomainException(
        'STATE_NOT_ALLOWED',
        'No tenés permisos para asignar este estado de cuenta.',
        HttpStatus.FORBIDDEN,
      );
    }

    const estado_anterior = usuario.estado;
    usuario.estado = dto.estado;

    if (
      estado_anterior === EstadoUsuario.ACTIVO &&
      dto.estado === EstadoUsuario.INACTIVO
    ) {
      usuario.token_version = (usuario.token_version ?? 0) + 1;
      usuario.fecha_baja = new Date();
    }

    if (dto.estado === EstadoUsuario.ACTIVO) {
      usuario.fecha_baja = null;
    }

    let invitacion_cancelada = false;
    if (
      estado_anterior === EstadoUsuario.PENDIENTE &&
      dto.estado === EstadoUsuario.INACTIVO
    ) {
      invitacion_cancelada =
        await this.fincas_service.cancelar_invitaciones_pendientes_por_email(
          usuario.email,
        );
      usuario.token_version = (usuario.token_version ?? 0) + 1;
      usuario.fecha_baja = new Date();
    }

    await this.save(usuario);

    await this.log_service.registrar({
      usuario: actor,
      tipo_operacion: TipoOperacion.EXITO,
      descripcion: `Cambio de estado de cuenta a ${dto.estado} para ${usuario.email}`,
      recurso: `Usuario:${usuario.id_usuario}`,
    });

    return {
      message: invitacion_cancelada
        ? 'Estado de cuenta actualizado correctamente. La invitación pendiente fue cancelada.'
        : 'Estado de cuenta actualizado correctamente.',
      id_usuario: Number(usuario.id_usuario),
      estado: usuario.estado,
    };
  }

  async listar_ambito_croply(query: ListarUsuariosQueryDto) {
    const page = query.page ?? 1;
    const pageSize = query.pageSize ?? 10;

    const listQb = this.usuario_repo
      .createQueryBuilder('u')
      .leftJoinAndSelect('u.rol_sistema', 'rol')
      .where('u.rol_sistema IS NOT NULL');

    this.apply_usuario_filters(listQb, query, 'rol');

    const totalItems = await listQb.getCount();
    const usuarios = await listQb
      .orderBy('u.apellido', 'ASC')
      .addOrderBy('u.nombre', 'ASC')
      .skip((page - 1) * pageSize)
      .take(pageSize)
      .getMany();

    return {
      usuarios: usuarios.map((u) => this.map_usuario_list_item(u, true)),
      pagination: build_page_size_pagination(page, pageSize, totalItems),
    };
  }

  async listar_ambito_finca(id_finca: number, query: ListarUsuariosQueryDto) {
    const page = query.page ?? 1;
    const pageSize = query.pageSize ?? 10;

    const listQb = this.usuario_repo
      .createQueryBuilder('u')
      .innerJoinAndSelect('u.usuario_fincas', 'uf')
      .innerJoinAndSelect('uf.finca', 'f')
      .leftJoinAndSelect('uf.rol_finca', 'rol')
      .where('f.id_finca = :id_finca', { id_finca });

    if (query.search?.trim()) {
      const term = `%${query.search.trim().toLowerCase()}%`;
      listQb.andWhere(
        '(LOWER(u.nombre) LIKE :term OR LOWER(u.apellido) LIKE :term OR LOWER(u.email) LIKE :term)',
        { term },
      );
    }
    if (query.estado) {
      listQb.andWhere('u.estado = :estado', { estado: query.estado });
    }
    if (query.id_rol) {
      listQb.andWhere('rol.id_rol = :id_rol', { id_rol: query.id_rol });
    }

    const totalItems = await listQb.getCount();
    const usuarios = await listQb
      .orderBy('u.apellido', 'ASC')
      .addOrderBy('u.nombre', 'ASC')
      .skip((page - 1) * pageSize)
      .take(pageSize)
      .getMany();

    return {
      usuarios: usuarios.map((u) =>
        this.map_usuario_list_item(u, false, id_finca),
      ),
      pagination: build_page_size_pagination(page, pageSize, totalItems),
    };
  }

  private apply_usuario_filters(
    qb: SelectQueryBuilder<Usuario>,
    query: ListarUsuariosQueryDto,
    rol_alias: string,
  ): void {
    if (query.search?.trim()) {
      const term = `%${query.search.trim().toLowerCase()}%`;
      qb.andWhere(
        '(LOWER(u.nombre) LIKE :term OR LOWER(u.apellido) LIKE :term OR LOWER(u.email) LIKE :term)',
        { term },
      );
    }
    if (query.estado) {
      qb.andWhere('u.estado = :estado', { estado: query.estado });
    }
    if (query.id_rol) {
      qb.andWhere(`${rol_alias}.id_rol = :id_rol`, { id_rol: query.id_rol });
    }
  }

  private map_usuario_list_item(
    usuario: Usuario,
    sistema: boolean,
    id_finca?: number,
  ) {
    let rol: { id_rol: number; nombre_rol: string } | null = null;
    if (sistema && usuario.rol_sistema) {
      rol = {
        id_rol: Number(usuario.rol_sistema.id_rol),
        nombre_rol: usuario.rol_sistema.nombre_rol,
      };
    } else if (id_finca != null) {
      const uf = (usuario.usuario_fincas ?? []).find(
        (x) => Number(x.finca?.id_finca) === Number(id_finca),
      );
      if (uf?.rol_finca) {
        rol = {
          id_rol: Number(uf.rol_finca.id_rol),
          nombre_rol: uf.rol_finca.nombre_rol,
        };
      }
    }

    return {
      id_usuario: Number(usuario.id_usuario),
      nombre: usuario.nombre,
      apellido: usuario.apellido,
      email: usuario.email,
      telefono: usuario.telefono,
      rol,
      estado: usuario.estado,
    };
  }

  private es_admin_finca_de_usuario(actor: Usuario, target: Usuario): boolean {
    const now = Date.now();
    const fincas_admin = new Set(
      (actor.usuario_fincas ?? [])
        .filter(
          (uf) =>
            uf.rol_finca?.codigo_rol_finca === CODIGO_ADMIN_FINCA &&
            (uf.fecha_fin_rol == null || uf.fecha_fin_rol.getTime() > now),
        )
        .map((uf) => Number(uf.finca.id_finca)),
    );

    return (target.usuario_fincas ?? []).some((uf) =>
      fincas_admin.has(Number(uf.finca.id_finca)),
    );
  }
}
