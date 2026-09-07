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
import { UsuarioFinca } from '../fincas/entities/usuario-finca.entity';
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
    @InjectRepository(UsuarioFinca)
    private readonly usuario_finca_repo: Repository<UsuarioFinca>,
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
      .where(
        `(
          rol.id_rol IS NOT NULL
          OR NOT EXISTS (
            SELECT 1 FROM usuario_finca uf_any
            WHERE uf_any.id_usuario = u.id_usuario
          )
          OR EXISTS (
            SELECT 1 FROM usuario_finca uf_adm
            INNER JOIN roles r_adm ON r_adm.id_rol = uf_adm.id_rol_finca
            WHERE uf_adm.id_usuario = u.id_usuario
              AND r_adm.codigo_rol_finca = :codigo_admin_finca
          )
        )`,
        { codigo_admin_finca: CODIGO_ADMIN_FINCA },
      );

    this.apply_usuario_filters(listQb, query, 'rol');

    const totalItems = await listQb.getCount();
    const usuarios = await listQb
      .orderBy('u.apellido', 'ASC')
      .addOrderBy('u.nombre', 'ASC')
      .skip((page - 1) * pageSize)
      .take(pageSize)
      .getMany();

    return {
      usuarios: usuarios.map((u) => this.map_usuario_croply_item(u)),
      pagination: build_page_size_pagination(page, pageSize, totalItems),
    };
  }

  async listar_administradores_finca_disponibles() {
    const usuarios = await this.usuario_repo
      .createQueryBuilder('u')
      .leftJoin('u.rol_sistema', 'rol')
      .where('rol.id_rol IS NULL')
      .andWhere('u.fecha_baja IS NULL')
      .andWhere('u.estado != :estado_inactivo', {
        estado_inactivo: EstadoUsuario.INACTIVO,
      })
      .orderBy('u.apellido', 'ASC')
      .addOrderBy('u.nombre', 'ASC')
      .getMany();

    return {
      usuarios: usuarios.map((usuario) => ({
        id_usuario: Number(usuario.id_usuario),
        nombre: usuario.nombre,
        apellido: usuario.apellido,
        email: usuario.email,
      })),
    };
  }

  /**
   * Listado por vinculación usuario-finca: una fila por finca. Con varias
   * fincas (multi-finca) un mismo usuario aparece una vez por cada una.
   */
  async listar_ambito_finca(
    ids_finca: number[],
    query: ListarUsuariosQueryDto,
  ) {
    const page = query.page ?? 1;
    const pageSize = query.pageSize ?? 10;

    if (ids_finca.length === 0) {
      return {
        usuarios: [],
        pagination: build_page_size_pagination(page, pageSize, 0),
      };
    }

    const listQb = this.usuario_finca_repo
      .createQueryBuilder('uf')
      .innerJoinAndSelect('uf.usuario', 'u')
      .innerJoinAndSelect('uf.finca', 'f')
      .leftJoinAndSelect('uf.rol_finca', 'rol')
      .where('f.id_finca IN (:...ids_finca)', { ids_finca })
      .andWhere('(uf.fecha_fin_rol IS NULL OR uf.fecha_fin_rol > NOW())');

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
    const vinculaciones = await listQb
      .orderBy('u.apellido', 'ASC')
      .addOrderBy('u.nombre', 'ASC')
      .addOrderBy('f.id_finca', 'ASC')
      .skip((page - 1) * pageSize)
      .take(pageSize)
      .getMany();

    return {
      usuarios: vinculaciones.map((uf) => this.map_usuario_finca_item(uf)),
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

  private map_usuario_croply_item(usuario: Usuario) {
    return {
      id_usuario: Number(usuario.id_usuario),
      nombre: usuario.nombre,
      apellido: usuario.apellido,
      email: usuario.email,
      telefono: usuario.telefono,
      rol: usuario.rol_sistema
        ? {
            id_rol: Number(usuario.rol_sistema.id_rol),
            nombre_rol: usuario.rol_sistema.nombre_rol,
          }
        : null,
      estado: usuario.estado,
    };
  }

  private map_usuario_finca_item(uf: UsuarioFinca) {
    const usuario = uf.usuario;
    return {
      id_usuario: Number(usuario.id_usuario),
      id_usuario_finca: Number(uf.id_usuario_finca),
      nombre: usuario.nombre,
      apellido: usuario.apellido,
      email: usuario.email,
      telefono: usuario.telefono,
      rol: uf.rol_finca
        ? {
            id_rol: Number(uf.rol_finca.id_rol),
            nombre_rol: uf.rol_finca.nombre_rol,
          }
        : null,
      finca: {
        id_finca: Number(uf.finca.id_finca),
        nombre_finca: uf.finca.nombre_finca,
      },
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
