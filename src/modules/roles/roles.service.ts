import { HttpStatus, Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { IsNull, Repository } from 'typeorm';
import {
  AmbitoPermiso,
  CODIGO_ADMIN_CROPLY,
  CODIGO_ADMIN_FINCA,
  TipoOperacion,
} from '../../common/enums';
import {
  DomainException,
  duplicateValue,
  resourceInUse,
  resourceNotFound,
} from '../../common/exceptions';
import { Finca } from '../fincas/entities/finca.entity';
import { UsuarioFinca } from '../fincas/entities/usuario-finca.entity';
import { Usuario } from '../usuarios/entities/usuario.entity';
import { LogOperacionesService } from '../log-operaciones';
import { Permiso } from './entities/permiso.entity';
import { RolPermiso } from './entities/rol-permiso.entity';
import { Rol, RolFinca, RolSistema } from './entities/rol.entity';
import { PERMISOS_SEED } from './permisos.seed';
import {
  ActualizarPermisosDto,
  CrearRolFincaDto,
  CrearRolSistemaDto,
} from './dto/crear-rol.dto';

@Injectable()
export class RolesService implements OnModuleInit {
  private readonly logger = new Logger(RolesService.name);

  constructor(
    @InjectRepository(RolSistema)
    private readonly rol_sistema_repo: Repository<RolSistema>,
    @InjectRepository(RolFinca)
    private readonly rol_finca_repo: Repository<RolFinca>,
    @InjectRepository(Permiso)
    private readonly permiso_repo: Repository<Permiso>,
    @InjectRepository(RolPermiso)
    private readonly rol_permiso_repo: Repository<RolPermiso>,
    @InjectRepository(Usuario)
    private readonly usuario_repo: Repository<Usuario>,
    @InjectRepository(UsuarioFinca)
    private readonly usuario_finca_repo: Repository<UsuarioFinca>,
    private readonly log_service: LogOperacionesService,
  ) {}

  async onModuleInit(): Promise<void> {
    await this.ensure_seed_roles();
    await this.ensure_seed_permisos();
  }

  async ensure_seed_roles(): Promise<void> {
    await this.ensure_rol_sistema(CODIGO_ADMIN_CROPLY, 'Administrador Croply');
    await this.ensure_rol_finca(CODIGO_ADMIN_FINCA, 'Administrador de Finca');
  }

  async ensure_seed_permisos(): Promise<void> {
    for (const item of PERMISOS_SEED) {
      const existing = await this.permiso_repo.findOne({
        where: {
          nombre_permiso: item.nombre_permiso,
          ambito: item.ambito,
        },
      });
      if (!existing) {
        await this.permiso_repo.save(this.permiso_repo.create(item));
        this.logger.log(
          `Permiso sembrado (${item.ambito}): ${item.nombre_permiso}`,
        );
      }
    }
  }

  async find_rol_sistema_by_codigo(codigo: string): Promise<RolSistema | null> {
    return this.rol_sistema_repo.findOne({ where: { codigo } });
  }

  async find_rol_sistema_by_id(id_rol: number): Promise<RolSistema | null> {
    return this.rol_sistema_repo.findOne({
      where: { id_rol },
      relations: ['rol_permisos', 'rol_permisos.permiso'],
    });
  }

  async find_rol_finca_by_codigo(codigo: string): Promise<RolFinca | null> {
    return this.rol_finca_repo.findOne({ where: { codigo_rol_finca: codigo } });
  }

  async find_rol_finca_by_nombre(
    id_finca: number,
    nombre_rol: string,
  ): Promise<RolFinca | null> {
    return this.rol_finca_repo.findOne({
      where: { finca: { id_finca }, nombre_rol, fecha_baja_rol: IsNull() },
      relations: ['finca', 'rol_permisos', 'rol_permisos.permiso'],
    });
  }

  async find_rol_finca_by_id(id_rol: number): Promise<RolFinca | null> {
    return this.rol_finca_repo.findOne({
      where: { id_rol },
      relations: ['finca', 'rol_permisos', 'rol_permisos.permiso'],
    });
  }

  async listar_roles_sistema() {
    const roles = await this.rol_sistema_repo.find({
      where: { fecha_baja_rol: IsNull() },
      relations: ['rol_permisos', 'rol_permisos.permiso'],
      order: { id_rol: 'ASC' },
    });

    const mapped = await Promise.all(
      roles.map(async (rol) => this.map_rol_sistema(rol)),
    );
    return { roles: mapped };
  }

  async crear_rol_sistema(dto: CrearRolSistemaDto, actor: Usuario) {
    const nombre = dto.nombre_rol.trim();
    const existente = await this.rol_sistema_repo.findOne({
      where: { nombre_rol: nombre, fecha_baja_rol: IsNull() },
    });
    if (existente) {
      throw duplicateValue('nombre_rol');
    }

    const codigo = await this.generar_codigo_sistema(nombre);
    const rol = await this.rol_sistema_repo.save(
      this.rol_sistema_repo.create({
        nombre_rol: nombre,
        descripcion: dto.descripcion?.trim() ?? null,
        codigo,
      }),
    );

    await this.log_service.registrar({
      usuario: actor,
      tipo_operacion: TipoOperacion.EXITO,
      descripcion: `Alta de rol de sistema ${nombre}`,
      recurso: `RolSistema:${rol.id_rol}`,
    });

    return {
      message: 'Rol creado correctamente',
      ...(await this.map_rol_sistema(rol)),
    };
  }

  async actualizar_rol_sistema(
    id_rol: number,
    dto: CrearRolSistemaDto,
    actor: Usuario,
  ) {
    const rol = await this.require_rol_sistema_activo(id_rol);
    const nombre = dto.nombre_rol.trim();
    const duplicado = await this.rol_sistema_repo.findOne({
      where: { nombre_rol: nombre, fecha_baja_rol: IsNull() },
    });
    if (duplicado && Number(duplicado.id_rol) !== Number(rol.id_rol)) {
      throw duplicateValue('nombre_rol');
    }

    rol.nombre_rol = nombre;
    rol.descripcion = dto.descripcion?.trim() ?? null;
    await this.rol_sistema_repo.save(rol);

    await this.log_service.registrar({
      usuario: actor,
      tipo_operacion: TipoOperacion.EXITO,
      descripcion: `Actualización de rol de sistema ${nombre}`,
      recurso: `RolSistema:${rol.id_rol}`,
    });

    return {
      message: 'Rol actualizado correctamente',
      ...(await this.map_rol_sistema(rol)),
    };
  }

  async dar_baja_rol_sistema(id_rol: number, actor: Usuario) {
    const rol = await this.require_rol_sistema_activo(id_rol);
    if (rol.codigo === CODIGO_ADMIN_CROPLY) {
      throw resourceInUse(
        'No puede eliminar el rol Administrador Croply del sistema.',
      );
    }

    const asignados = await this.usuario_repo.count({
      where: { rol_sistema: { id_rol: rol.id_rol } },
    });

    await this.usuario_repo
      .createQueryBuilder()
      .update(Usuario)
      .set({ rol_sistema: null })
      .where('id_rol_sistema = :id_rol', { id_rol: rol.id_rol })
      .execute();

    rol.fecha_baja_rol = new Date();
    await this.rol_sistema_repo.save(rol);

    await this.log_service.registrar({
      usuario: actor,
      tipo_operacion: TipoOperacion.OPERACION_DESTRUCTIVA,
      descripcion: `Baja de rol de sistema ${rol.nombre_rol}`,
      recurso: `RolSistema:${rol.id_rol}`,
    });

    return {
      message:
        asignados > 0
          ? 'Rol dado de baja correctamente. Los usuarios afectados quedaron sin rol asignado.'
          : 'Rol dado de baja correctamente',
      id_rol: Number(rol.id_rol),
    };
  }

  async listar_permisos(ambito: AmbitoPermiso) {
    const permisos = await this.permiso_repo.find({
      where: { ambito },
      order: { id_permiso: 'ASC' },
    });
    return {
      permisos: permisos.map((p) => ({
        id_permiso: Number(p.id_permiso),
        nombre_permiso: p.nombre_permiso,
      })),
    };
  }

  async actualizar_permisos_rol_sistema(
    id_rol: number,
    dto: ActualizarPermisosDto,
    actor: Usuario,
  ) {
    if (!dto.permisos?.length) {
      throw new DomainException(
        'NO_PERMISSIONS_SELECTED',
        'Un rol debe contener al menos un permiso habilitado.',
        HttpStatus.BAD_REQUEST,
      );
    }

    const rol = await this.require_rol_sistema_activo(id_rol);
    await this.replace_permisos(rol, dto.permisos, AmbitoPermiso.SISTEMA);

    await this.log_service.registrar({
      usuario: actor,
      tipo_operacion: TipoOperacion.EXITO,
      descripcion: `Actualización de permisos del rol de sistema ${rol.nombre_rol}`,
      recurso: `RolSistema:${rol.id_rol}`,
    });

    return { message: 'Rol actualizado correctamente.' };
  }

  async listar_roles_finca(id_finca: number) {
    const roles = await this.rol_finca_repo.find({
      where: [
        { finca: { id_finca }, fecha_baja_rol: IsNull() },
        {
          codigo_rol_finca: CODIGO_ADMIN_FINCA,
          finca: IsNull(),
          fecha_baja_rol: IsNull(),
        },
      ],
      relations: ['finca', 'rol_permisos', 'rol_permisos.permiso'],
      order: { id_rol: 'ASC' },
    });

    const mapped = await Promise.all(
      roles.map(async (rol) => this.map_rol_finca(rol, id_finca)),
    );
    return { roles: mapped };
  }

  async crear_rol_finca(
    id_finca: number,
    dto: CrearRolFincaDto,
    actor: Usuario,
    finca: Finca,
  ) {
    if (!dto.permisos?.length) {
      throw new DomainException(
        'NO_PERMISSIONS_SELECTED',
        'Debe seleccionar al menos un permiso para guardar el rol.',
        HttpStatus.BAD_REQUEST,
      );
    }

    const nombre = dto.nombre_rol.trim();
    await this.assert_nombre_rol_finca_unico(id_finca, nombre);

    const codigo_rol_finca = await this.generar_codigo_finca(id_finca, nombre);
    const rol = await this.rol_finca_repo.save(
      this.rol_finca_repo.create({
        nombre_rol: nombre,
        descripcion: dto.descripcion?.trim() ?? null,
        codigo_rol_finca,
        finca,
      }),
    );

    await this.replace_permisos(rol, dto.permisos, AmbitoPermiso.FINCA);
    const completo = await this.find_rol_finca_by_id(rol.id_rol);

    await this.log_service.registrar({
      usuario: actor,
      tipo_operacion: TipoOperacion.EXITO,
      descripcion: `Alta de rol de finca ${nombre}`,
      recurso: `RolFinca:${rol.id_rol}`,
    });

    return {
      message: 'Rol creado correctamente',
      ...(await this.map_rol_finca(completo, id_finca)),
    };
  }

  async actualizar_rol_finca(
    id_finca: number,
    id_rol: number,
    dto: CrearRolFincaDto,
    actor: Usuario,
  ) {
    if (!dto.permisos?.length) {
      throw new DomainException(
        'NO_PERMISSIONS_SELECTED',
        'Debe seleccionar al menos un permiso para guardar el rol.',
        HttpStatus.BAD_REQUEST,
      );
    }

    const rol = await this.require_rol_finca_de_finca(id_finca, id_rol);
    if (rol.codigo_rol_finca === CODIGO_ADMIN_FINCA && rol.finca == null) {
      throw new DomainException(
        'FORBIDDEN',
        'No se puede editar el rol plantilla Administrador de Finca.',
        HttpStatus.FORBIDDEN,
      );
    }

    const nombre = dto.nombre_rol.trim();
    await this.assert_nombre_rol_finca_unico(id_finca, nombre, id_rol);

    rol.nombre_rol = nombre;
    rol.descripcion = dto.descripcion?.trim() ?? null;
    await this.rol_finca_repo.save(rol);
    await this.replace_permisos(rol, dto.permisos, AmbitoPermiso.FINCA);

    const completo = await this.find_rol_finca_by_id(rol.id_rol);

    await this.log_service.registrar({
      usuario: actor,
      tipo_operacion: TipoOperacion.EXITO,
      descripcion: `Actualización de rol de finca ${nombre}`,
      recurso: `RolFinca:${rol.id_rol}`,
    });

    return {
      message: 'Rol actualizado correctamente',
      ...(await this.map_rol_finca(completo, id_finca)),
    };
  }

  async dar_baja_rol_finca(
    id_finca: number,
    id_rol: number,
    actor: Usuario,
  ) {
    const rol = await this.require_rol_finca_de_finca(id_finca, id_rol);
    if (rol.codigo_rol_finca === CODIGO_ADMIN_FINCA && rol.finca == null) {
      throw resourceInUse(
        'No puede eliminar el rol plantilla Administrador de Finca.',
      );
    }

    const asignados = await this.count_usuarios_rol_finca(id_finca, id_rol);
    if (asignados > 0) {
      throw resourceInUse(
        'No puede eliminar un rol que está asignado a usuarios activos. Reasigne a los trabajadores antes de continuar.',
      );
    }

    rol.fecha_baja_rol = new Date();
    await this.rol_finca_repo.save(rol);

    await this.log_service.registrar({
      usuario: actor,
      tipo_operacion: TipoOperacion.OPERACION_DESTRUCTIVA,
      descripcion: `Baja de rol de finca ${rol.nombre_rol}`,
      recurso: `RolFinca:${rol.id_rol}`,
    });

    return {
      message: 'Rol dado de baja correctamente',
      id_rol: Number(rol.id_rol),
    };
  }

  async actualizar_permisos_rol_finca(
    id_finca: number,
    id_rol: number,
    dto: ActualizarPermisosDto,
    actor: Usuario,
  ) {
    if (!dto.permisos?.length) {
      throw new DomainException(
        'NO_PERMISSIONS_SELECTED',
        'Un rol debe contener al menos un permiso habilitado.',
        HttpStatus.BAD_REQUEST,
      );
    }

    const rol = await this.require_rol_finca_de_finca(id_finca, id_rol);
    await this.replace_permisos(rol, dto.permisos, AmbitoPermiso.FINCA);

    await this.log_service.registrar({
      usuario: actor,
      tipo_operacion: TipoOperacion.EXITO,
      descripcion: `Actualización de permisos del rol de finca ${rol.nombre_rol}`,
      recurso: `RolFinca:${rol.id_rol}`,
    });

    return { message: 'Rol actualizado correctamente.' };
  }

  private async map_rol_sistema(rol: RolSistema) {
    const cantidad = await this.usuario_repo.count({
      where: { rol_sistema: { id_rol: rol.id_rol } },
    });
    return {
      id_rol: Number(rol.id_rol),
      nombre_rol: rol.nombre_rol,
      descripcion: rol.descripcion,
      permisos: this.map_permisos(rol),
      cantidad_usuarios_asignados: cantidad,
    };
  }

  private async map_rol_finca(rol: RolFinca, id_finca: number) {
    const cantidad = await this.count_usuarios_rol_finca(id_finca, rol.id_rol);

    return {
      id_rol: Number(rol.id_rol),
      nombre_rol: rol.nombre_rol,
      descripcion: rol.descripcion,
      permisos: this.map_permisos(rol),
      cantidad_usuarios_asignados: cantidad,
    };
  }

  private map_permisos(rol: Rol) {
    return (rol.rol_permisos ?? [])
      .filter((rp) => rp.permiso)
      .map((rp) => ({
        id_permiso: Number(rp.permiso.id_permiso),
        nombre_permiso: rp.permiso.nombre_permiso,
      }))
      .sort((a, b) => a.id_permiso - b.id_permiso);
  }

  private async count_usuarios_rol_finca(
    id_finca: number,
    id_rol: number,
  ): Promise<number> {
    return this.usuario_finca_repo
      .createQueryBuilder('uf')
      .innerJoin('uf.finca', 'f')
      .innerJoin('uf.rol_finca', 'r')
      .where('f.id_finca = :id_finca', { id_finca })
      .andWhere('r.id_rol = :id_rol', { id_rol })
      .andWhere('(uf.fecha_fin_rol IS NULL OR uf.fecha_fin_rol > NOW())')
      .getCount();
  }

  private async require_rol_sistema_activo(
    id_rol: number,
  ): Promise<RolSistema> {
    const rol = await this.find_rol_sistema_by_id(id_rol);
    if (!rol || rol.fecha_baja_rol != null) {
      throw resourceNotFound();
    }
    return rol;
  }

  private async require_rol_finca_de_finca(
    id_finca: number,
    id_rol: number,
  ): Promise<RolFinca> {
    const rol = await this.find_rol_finca_by_id(id_rol);
    if (!rol || rol.fecha_baja_rol != null) {
      throw resourceNotFound();
    }

    const es_plantilla_admin =
      rol.codigo_rol_finca === CODIGO_ADMIN_FINCA && rol.finca == null;
    const pertenece_finca =
      rol.finca != null && Number(rol.finca.id_finca) === Number(id_finca);

    if (!es_plantilla_admin && !pertenece_finca) {
      throw resourceNotFound();
    }

    return rol;
  }

  private async assert_nombre_rol_finca_unico(
    id_finca: number,
    nombre: string,
    exclude_id?: number,
  ): Promise<void> {
    const existentes = await this.rol_finca_repo.find({
      where: [
        { finca: { id_finca }, nombre_rol: nombre, fecha_baja_rol: IsNull() },
        {
          codigo_rol_finca: CODIGO_ADMIN_FINCA,
          finca: IsNull(),
          nombre_rol: nombre,
          fecha_baja_rol: IsNull(),
        },
      ],
    });

    const conflicto = existentes.find(
      (r) => exclude_id == null || Number(r.id_rol) !== Number(exclude_id),
    );
    if (conflicto) {
      throw duplicateValue('nombre_rol');
    }
  }

  private async replace_permisos(
    rol: Rol,
    ids: number[],
    ambito: AmbitoPermiso,
  ): Promise<void> {
    const unique_ids = [...new Set(ids.map(Number))];
    const permisos = await this.permiso_repo
      .createQueryBuilder('p')
      .where('p.id_permiso IN (:...ids)', { ids: unique_ids })
      .andWhere('p.ambito = :ambito', { ambito })
      .getMany();

    if (permisos.length !== unique_ids.length) {
      throw resourceNotFound();
    }

    await this.rol_permiso_repo.delete({ rol: { id_rol: rol.id_rol } });
    await this.rol_permiso_repo.save(
      permisos.map((permiso) =>
        this.rol_permiso_repo.create({ rol, permiso }),
      ),
    );
  }

  private async generar_codigo_sistema(nombre: string): Promise<string> {
    const base = this.slugify(nombre).toUpperCase() || 'ROL';
    let codigo = base;
    let i = 1;
    while (await this.rol_sistema_repo.findOne({ where: { codigo } })) {
      codigo = `${base}_${i++}`;
    }
    return codigo;
  }

  private async generar_codigo_finca(
    id_finca: number,
    nombre: string,
  ): Promise<string> {
    const base = `F${id_finca}_${this.slugify(nombre).toUpperCase() || 'ROL'}`;
    let codigo = base;
    let i = 1;
    while (
      await this.rol_finca_repo.findOne({ where: { codigo_rol_finca: codigo } })
    ) {
      codigo = `${base}_${i++}`;
    }
    return codigo;
  }

  private slugify(value: string): string {
    return value
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .replace(/[^a-zA-Z0-9]+/g, '_')
      .replace(/^_|_$/g, '')
      .slice(0, 40);
  }

  private async ensure_rol_sistema(
    codigo: string,
    nombre_rol: string,
  ): Promise<void> {
    const existing = await this.rol_sistema_repo.findOne({ where: { codigo } });
    if (!existing) {
      await this.rol_sistema_repo.save(
        this.rol_sistema_repo.create({
          codigo,
          nombre_rol,
          descripcion: null,
        }),
      );
      this.logger.log(`Rol de sistema sembrado: ${codigo}`);
    }
  }

  private async ensure_rol_finca(
    codigo_rol_finca: string,
    nombre_rol: string,
  ): Promise<void> {
    const existing = await this.rol_finca_repo.findOne({
      where: { codigo_rol_finca },
    });
    if (!existing) {
      await this.rol_finca_repo.save(
        this.rol_finca_repo.create({
          codigo_rol_finca,
          nombre_rol,
          descripcion: null,
          finca: null,
        }),
      );
      this.logger.log(`Rol de finca sembrado: ${codigo_rol_finca}`);
    }
  }
}
