import { HttpStatus, Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { IsNull, MoreThan, Repository, SelectQueryBuilder } from 'typeorm';
import {
  CODIGO_ADMIN_FINCA,
  EstadoInvitacion,
  EstadoUsuario,
  TipoOperacion,
  EstadoParcela,
} from '../../common/enums';
import { build_page_size_pagination } from '../../common/dto';
import {
  DomainException,
  resourceNotFound,
} from '../../common/exceptions';
import { generate_token, hash_token } from '../auth/auth.crypto';
import { MailerStubService } from '../../common/mailer';
import { LogOperacionesService } from '../log-operaciones';
import { RolesService } from '../roles/roles.service';
import { Usuario } from '../usuarios/entities/usuario.entity';
import { Finca } from './entities/finca.entity';
import { InvitacionFinca } from './entities/invitacion-finca.entity';
import { UsuarioFinca } from './entities/usuario-finca.entity';
import { RolFinca } from '../roles/entities/rol.entity';
import { Parcela } from '../parcelas/entities/parcela.entity';
import { Sensor } from '../parcelas/entities/sensor.entity';
import {
  ActualizarFincaDto,
  CrearFincaDto,
  CrearInvitacionDto,
  ListarFincasQueryDto,
} from './dto/fincas.dto';

const INVITATION_TTL_DAYS = 7;

@Injectable()
export class FincasService {
  constructor(
    @InjectRepository(Finca)
    private readonly finca_repo: Repository<Finca>,
    @InjectRepository(UsuarioFinca)
    private readonly usuario_finca_repo: Repository<UsuarioFinca>,
    @InjectRepository(Usuario)
    private readonly usuario_repo: Repository<Usuario>,
    @InjectRepository(Parcela)
    private readonly parcela_repo: Repository<Parcela>,
    @InjectRepository(Sensor)
    private readonly sensor_repo: Repository<Sensor>,
    @InjectRepository(InvitacionFinca)
    private readonly invitacion_repo: Repository<InvitacionFinca>,
    private readonly roles_service: RolesService,
    private readonly mailer: MailerStubService,
    private readonly log_service: LogOperacionesService,
  ) {}

  async find_finca_by_id(id_finca: number): Promise<Finca | null> {
    return this.finca_repo.findOne({ where: { id_finca } });
  }

  async find_finca_by_nombre(nombre_finca: string): Promise<Finca | null> {
    return this.finca_repo.findOne({ where: { nombre_finca } });
  }

  async crear_finca(data: Partial<Finca>): Promise<Finca> {
    return this.finca_repo.save(this.finca_repo.create(data));
  }

  async listar_fincas(query: ListarFincasQueryDto) {
    const page = query.page ?? 1;
    const pageSize = query.pageSize ?? 10;
    const listQb = this.finca_query();

    if (query.estado === EstadoUsuario.ACTIVO) {
      listQb.andWhere('f.fecha_baja_finca IS NULL');
    } else if (query.estado === EstadoUsuario.INACTIVO) {
      listQb.andWhere('f.fecha_baja_finca IS NOT NULL');
    }

    const totalItems = await listQb.getCount();
    const fincas = await listQb
      .orderBy('f.id_finca', 'ASC')
      .skip((page - 1) * pageSize)
      .take(pageSize)
      .getMany();

    return {
      fincas: fincas.map((finca) => this.map_finca_list_item(finca)),
      pagination: build_page_size_pagination(page, pageSize, totalItems),
    };
  }

  async obtener_stats() {
    const result = await this.finca_repo
      .createQueryBuilder('f')
      .select('COALESCE(SUM(f.superficie_finca), 0)', 'superficie_gestionada_total')
      .where('f.fecha_baja_finca IS NULL')
      .getRawOne<{ superficie_gestionada_total: string }>();

    const sensores_totales = await this.sensor_repo
      .createQueryBuilder('s')
      .innerJoin('s.controlador', 'c')
      .innerJoin('c.parcela', 'p')
      .innerJoin('p.finca', 'f')
      .where('s.fecha_baja IS NULL')
      .andWhere('c.fecha_baja IS NULL')
      .andWhere('p.fecha_baja_parcela IS NULL')
      .andWhere('f.fecha_baja_finca IS NULL')
      .getCount();

    return {
      sensores_totales,
      superficie_gestionada_total: Number(result?.superficie_gestionada_total ?? 0),
    };
  }

  async obtener_detalle(id_finca: number) {
    const finca = await this.finca_query()
      .andWhere('f.id_finca = :id_finca', { id_finca })
      .getOne();
    if (!finca) {
      throw resourceNotFound();
    }
    return this.map_finca_detail(finca);
  }

  async crear_finca_desde_dto(dto: CrearFincaDto, actor: Usuario) {
    const nombre_finca = dto.nombre_finca.trim();
    const existente = await this.finca_repo.findOne({
      where: { nombre_finca, fecha_baja_finca: IsNull() },
    });
    if (existente) {
      throw new DomainException(
        'DUPLICATE_VALUE',
        'El valor ingresado ya existe',
        HttpStatus.CONFLICT,
        'nombre_finca',
      );
    }

    const finca = await this.crear_finca({
      nombre_finca,
      provincia: dto.provincia.trim(),
      departamento: dto.departamento.trim(),
      longitud: dto.longitud,
      latitud: dto.latitud,
      superficie_finca: dto.superficie_finca,
      descripcion_finca: dto.descripcion_finca?.trim() ?? null,
      fecha_baja_finca: null,
    });

    await this.log_service.registrar({
      usuario: actor,
      tipo_operacion: TipoOperacion.EXITO,
      descripcion: `Alta de finca ${finca.nombre_finca}`,
      recurso: `Finca:${finca.id_finca}`,
    });

    return {
      message: 'Finca creada correctamente',
      ...(await this.obtener_detalle(finca.id_finca)),
    };
  }

  async actualizar_finca(
    id_finca: number,
    dto: ActualizarFincaDto,
    actor: Usuario,
  ) {
    const finca = await this.require_finca(id_finca);
    if (dto.nombre_finca !== undefined) {
      const nombre_finca = dto.nombre_finca.trim();
      const duplicada = await this.finca_repo.findOne({
        where: { nombre_finca, fecha_baja_finca: IsNull() },
      });
      if (duplicada && Number(duplicada.id_finca) !== Number(id_finca)) {
        throw new DomainException(
          'DUPLICATE_VALUE',
          'El valor ingresado ya existe',
          HttpStatus.CONFLICT,
          'nombre_finca',
        );
      }
      finca.nombre_finca = nombre_finca;
    }
    if (dto.superficie_finca !== undefined) {
      finca.superficie_finca = dto.superficie_finca;
    }
    if (dto.descripcion_finca !== undefined) {
      finca.descripcion_finca = dto.descripcion_finca.trim();
    }
    await this.finca_repo.save(finca);

    await this.log_service.registrar({
      usuario: actor,
      tipo_operacion: TipoOperacion.EXITO,
      descripcion: `Actualización de finca ${finca.nombre_finca}`,
      recurso: `Finca:${finca.id_finca}`,
    });

    return { message: 'Finca actualizada correctamente' };
  }

  async dar_baja_finca(id_finca: number, actor: Usuario) {
    const finca = await this.require_finca(id_finca);

    // Confirmado: baja lógica en cascada — cambia estado a Inactivo, inactiva parcelas asociadas, cancela tareas pendientes de esas parcelas, conserva histórico de agroquímicos sin modificar, inactiva cultivos activos, revoca accesos de usuarios invitados sin tocar el estado de cuenta del Administrador de Finca.
    finca.fecha_baja_finca = new Date();
    await this.finca_repo.save(finca);

    await this.log_service.registrar({
      usuario: actor,
      tipo_operacion: TipoOperacion.OPERACION_DESTRUCTIVA,
      descripcion: `Baja de finca ${finca.nombre_finca}`,
      recurso: `Finca:${finca.id_finca}`,
    });

    return {
      message:
        'Finca dada de baja correctamente. Las parcelas y datos asociados fueron actualizados.',
    };
  }

  async asignar_propietario(
    id_finca: number,
    id_usuario_propietario: number | null | undefined,
    actor: Usuario,
  ) {
    const finca = await this.require_finca(id_finca);
    const propietario_actual = await this.usuario_finca_repo.findOne({
      where: {
        finca: { id_finca },
        rol_finca: { codigo_rol_finca: CODIGO_ADMIN_FINCA },
        fecha_fin_rol: IsNull(),
      },
      relations: ['usuario', 'finca', 'rol_finca'],
    });

    if (propietario_actual) {
      propietario_actual.fecha_fin_rol = new Date();
      await this.usuario_finca_repo.save(propietario_actual);
    }

    if (id_usuario_propietario != null) {
      const usuario = await this.usuario_repo.findOne({
        where: { id_usuario: id_usuario_propietario },
        relations: ['rol_sistema'],
      });
      if (
        !usuario ||
        usuario.rol_sistema != null ||
        usuario.fecha_baja != null ||
        usuario.estado === EstadoUsuario.INACTIVO
      ) {
        throw resourceNotFound();
      }

      const rol_admin_finca = await this.roles_service.find_rol_finca_by_codigo(
        CODIGO_ADMIN_FINCA,
      );
      if (!rol_admin_finca) {
        throw resourceNotFound();
      }

      await this.usuario_finca_repo.save(
        this.usuario_finca_repo.create({
          usuario,
          finca,
          rol_finca: rol_admin_finca,
          fecha_fin_rol: null,
        }),
      );
    }

    await this.log_service.registrar({
      usuario: actor,
      tipo_operacion: TipoOperacion.EXITO,
      descripcion: id_usuario_propietario == null
        ? `Desvinculación del propietario de la finca ${finca.nombre_finca}`
        : `Asignación de propietario a la finca ${finca.nombre_finca}`,
      recurso: `Finca:${finca.id_finca}`,
    });

    return { message: 'Finca actualizada correctamente' };
  }

  private finca_query(): SelectQueryBuilder<Finca> {
    return this.finca_repo
      .createQueryBuilder('f')
      .leftJoinAndSelect(
        'f.usuario_fincas',
        'uf',
        '(uf.fecha_fin_rol IS NULL OR uf.fecha_fin_rol > NOW())',
      )
      .leftJoinAndSelect('uf.usuario', 'u')
      .leftJoinAndSelect(
        'uf.rol_finca',
        'rf',
        'rf.codigo_rol_finca = :codigo_admin_finca',
        { codigo_admin_finca: CODIGO_ADMIN_FINCA },
      )
      .leftJoinAndSelect(
        'f.parcelas',
        'p',
        'p.estado_parcela = :estado_parcela',
        { estado_parcela: EstadoParcela.ACTIVA },
      )
      .leftJoinAndSelect(
        'p.controladores',
        'c',
        'c.fecha_baja IS NULL',
      )
      .leftJoinAndSelect(
        'c.sensores',
        's',
        's.fecha_baja IS NULL',
      )
      .leftJoinAndSelect('s.tipo_sensor', 'ts')
      .distinct(true);
  }

  private map_propietario(finca: Finca) {
    const uf = (finca.usuario_fincas ?? []).find(
      (item) => item.rol_finca?.codigo_rol_finca === CODIGO_ADMIN_FINCA,
    );
    if (!uf?.usuario) {
      return null;
    }
    return {
      id_usuario: Number(uf.usuario.id_usuario),
      id_usuario_finca: Number(uf.id_usuario_finca),
      nombre: uf.usuario.nombre,
      apellido: uf.usuario.apellido,
      email: uf.usuario.email,
      estado: uf.usuario.estado,
    };
  }

  private map_finca_list_item(finca: Finca) {
    return {
      id_finca: Number(finca.id_finca),
      nombre_finca: finca.nombre_finca,
      propietario: this.map_propietario(finca),
      provincia: finca.provincia,
      departamento: finca.departamento,
      longitud: finca.longitud,
      latitud: finca.latitud,
      cantidad_sensores: this.contar_sensores(finca),
      estado: finca.fecha_baja_finca == null ? 'Activo' : 'Inactivo',
    };
  }

  private map_finca_detail(finca: Finca) {
    return {
      id_finca: Number(finca.id_finca),
      nombre_finca: finca.nombre_finca,
      provincia: finca.provincia,
      departamento: finca.departamento,
      longitud: finca.longitud,
      latitud: finca.latitud,
      superficie_finca: finca.superficie_finca,
      descripcion_finca: finca.descripcion_finca,
      propietario: this.map_propietario(finca),
      estado: finca.fecha_baja_finca == null ? 'Activo' : 'Inactivo',
      cantidad_parcelas: (finca.parcelas ?? []).length,
      cantidad_sensores: this.contar_sensores(finca),
      parcelas: (finca.parcelas ?? []).map((parcela) => this.map_parcela(parcela)),
    };
  }

  private contar_sensores(finca: Finca): number {
    return (finca.parcelas ?? []).reduce(
      (total, parcela) =>
        total +
        (parcela.controladores ?? []).reduce(
          (subtotal, controlador) =>
            subtotal +
            (controlador.sensores ?? []).filter(
              (sensor) => sensor.fecha_baja == null,
            ).length,
          0,
        ),
      0,
    );
  }

  private map_parcela(parcela: Parcela) {
    return {
      id_parcela: Number(parcela.id_parcela),
      nombre_parcela: parcela.nombre_parcela,
      estado_parcela: parcela.estado_parcela,
      controladores: (parcela.controladores ?? [])
        .filter((controlador) => controlador.fecha_baja == null)
        .map((controlador) => ({
          id_controlador_sensor: Number(controlador.id_controlador_sensor),
          nombre_controlador: controlador.nombre_controlador,
          ip_controlador: controlador.ip_controlador,
          estado_controlador: controlador.estado_controlador,
          sensores: (controlador.sensores ?? [])
            .filter((sensor) => sensor.fecha_baja == null)
            .map((sensor) => ({
              id_sensor: Number(sensor.id_sensor),
              codigo_tipo_sensor: sensor.tipo_sensor?.codigo_tipo_sensor,
              nombre_tipo_sensor: sensor.tipo_sensor?.nombre_tipo_sensor,
              ip_sensor: sensor.ip_sensor,
              estado_senal: sensor.estado_senal,
              ultimo_valor: sensor.ultimo_valor,
              fecha_ultima_lectura: sensor.fecha_ultima_lectura,
            })),
        })),
    };
  }

  async find_usuario_finca(
    id_usuario: number,
    id_finca: number,
  ): Promise<UsuarioFinca | null> {
    return this.usuario_finca_repo.findOne({
      where: { usuario: { id_usuario }, finca: { id_finca } },
      relations: ['usuario', 'finca', 'rol_finca'],
    });
  }

  async require_finca(id_finca: number): Promise<Finca> {
    const finca = await this.find_finca_by_id(id_finca);
    if (!finca || finca.fecha_baja_finca != null) {
      throw resourceNotFound();
    }
    return finca;
  }

  /** Vinculaciones vigentes del usuario, opcionalmente solo donde es Admin de Finca. */
  private vinculaciones_vigentes(
    usuario: Usuario,
    solo_admin = false,
  ): UsuarioFinca[] {
    const now = Date.now();
    return (usuario.usuario_fincas ?? []).filter(
      (uf) =>
        uf.finca != null &&
        (uf.fecha_fin_rol == null || uf.fecha_fin_rol.getTime() > now) &&
        (!solo_admin ||
          uf.rol_finca?.codigo_rol_finca === CODIGO_ADMIN_FINCA),
    );
  }

  listar_mis_fincas(usuario: Usuario) {
    const fincas = this.vinculaciones_vigentes(usuario)
      .map((uf) => ({
        id_finca: Number(uf.finca.id_finca),
        nombre_finca: uf.finca.nombre_finca,
        rol_finca: uf.rol_finca?.codigo_rol_finca ?? null,
        nombre_rol: uf.rol_finca?.nombre_rol ?? null,
        es_admin: uf.rol_finca?.codigo_rol_finca === CODIGO_ADMIN_FINCA,
      }))
      .sort((a, b) => a.id_finca - b.id_finca);

    return { fincas };
  }

  /**
   * Fincas sobre las que el usuario tiene alcance como Admin de Finca.
   * `id_finca` acota el resultado a una sola y falla si no la administra.
   */
  resolver_fincas_administradas(
    usuario: Usuario,
    id_finca?: number,
  ): number[] {
    const ids = this.vinculaciones_vigentes(usuario, true).map((uf) =>
      Number(uf.finca.id_finca),
    );

    if (ids.length === 0) {
      throw new DomainException(
        'FORBIDDEN',
        'No tenés permisos para realizar esta acción',
        HttpStatus.FORBIDDEN,
      );
    }

    if (id_finca == null) {
      return ids;
    }

    if (!ids.includes(Number(id_finca))) {
      throw resourceNotFound();
    }
    return [Number(id_finca)];
  }

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

  async cancelar_invitaciones_pendientes_por_email(
    email: string,
  ): Promise<boolean> {
    const pendientes = await this.invitacion_repo.find({
      where: {
        email_invitado: email.toLowerCase(),
        estado: EstadoInvitacion.PENDIENTE,
      },
    });

    if (pendientes.length === 0) {
      return false;
    }

    const now = new Date();
    for (const invitacion of pendientes) {
      invitacion.estado = EstadoInvitacion.CANCELADA;
      invitacion.fecha_cancelacion = now;
      await this.invitacion_repo.save(invitacion);
    }
    return true;
  }

  private async resolve_rol_finca_para_finca(
    id_finca: number,
    id_rol: number,
  ): Promise<RolFinca> {
    const rol = await this.roles_service.find_rol_finca_by_id(id_rol);
    if (!rol || rol.fecha_baja_rol != null) {
      throw resourceNotFound();
    }

    const es_plantilla = rol.finca == null;
    const pertenece =
      rol.finca != null && Number(rol.finca.id_finca) === Number(id_finca);
    if (!es_plantilla && !pertenece) {
      throw resourceNotFound();
    }
    return rol;
  }

  async crear_invitacion(
    id_finca: number,
    dto: CrearInvitacionDto,
    actor: Usuario,
  ) {
    const finca = await this.require_finca(id_finca);
    const email = dto.email_invitado.toLowerCase();
    const rol = await this.resolve_rol_finca_para_finca(id_finca, dto.id_rol);

    const ya_vinculado = await this.usuario_finca_repo
      .createQueryBuilder('uf')
      .innerJoin('uf.usuario', 'u')
      .innerJoin('uf.finca', 'f')
      .where('f.id_finca = :id_finca', { id_finca })
      .andWhere('LOWER(u.email) = :email', { email })
      .andWhere('u.estado = :estado', { estado: EstadoUsuario.ACTIVO })
      .andWhere('(uf.fecha_fin_rol IS NULL OR uf.fecha_fin_rol > NOW())')
      .getCount();

    if (ya_vinculado > 0) {
      throw new DomainException(
        'USER_ALREADY_LINKED',
        'Este usuario ya se encuentra vinculado a tu establecimiento.',
        HttpStatus.BAD_REQUEST,
      );
    }

    const pendiente = await this.invitacion_repo.findOne({
      where: {
        email_invitado: email,
        estado: EstadoInvitacion.PENDIENTE,
        finca: { id_finca },
      },
    });

    if (pendiente) {
      throw new DomainException(
        'PENDING_INVITATION_EXISTS',
        'Ya existe una invitación pendiente para este correo.',
        HttpStatus.CONFLICT,
        undefined,
        { id_invitacion_finca: Number(pendiente.id_invitacion_finca) },
      );
    }

    const token = generate_token();
    const token_hash = await hash_token(token);
    const fecha_fin_vigencia = new Date();
    fecha_fin_vigencia.setDate(
      fecha_fin_vigencia.getDate() + INVITATION_TTL_DAYS,
    );

    const invitacion = await this.invitacion_repo.save(
      this.invitacion_repo.create({
        email_invitado: email,
        token_hash,
        fecha_fin_vigencia,
        fecha_respuesta: null,
        fecha_cancelacion: null,
        estado: EstadoInvitacion.PENDIENTE,
        finca,
        rol_finca: rol,
        invitado_por: actor,
        usuario_registrado: null,
      }),
    );

    await this.mailer.send_invitation(email, token);

    await this.log_service.registrar({
      usuario: actor,
      tipo_operacion: TipoOperacion.EXITO,
      descripcion: `Invitación enviada a ${email}`,
      recurso: `InvitacionFinca:${invitacion.id_invitacion_finca}`,
    });

    return {
      message: 'Invitación enviada correctamente',
      id_invitacion_finca: Number(invitacion.id_invitacion_finca),
      email_invitado: invitacion.email_invitado,
      id_rol: Number(invitacion.rol_finca.id_rol),
      estado: invitacion.estado,
      fecha_envio: invitacion.fecha_envio.toISOString(),
    };
  }

  async reenviar_invitacion(id_invitacion_finca: number, actor: Usuario) {
    const invitacion = await this.find_invitacion_by_id(id_invitacion_finca);
    if (
      !invitacion ||
      invitacion.estado !== EstadoInvitacion.PENDIENTE ||
      invitacion.fecha_cancelacion != null
    ) {
      throw resourceNotFound();
    }

    const token = generate_token();
    invitacion.token_hash = await hash_token(token);
    invitacion.fecha_envio = new Date();
    const fecha_fin_vigencia = new Date();
    fecha_fin_vigencia.setDate(
      fecha_fin_vigencia.getDate() + INVITATION_TTL_DAYS,
    );
    invitacion.fecha_fin_vigencia = fecha_fin_vigencia;
    await this.save_invitacion(invitacion);

    await this.mailer.send_invitation(invitacion.email_invitado, token);

    await this.log_service.registrar({
      usuario: actor,
      tipo_operacion: TipoOperacion.EXITO,
      descripcion: `Reenvío de invitación a ${invitacion.email_invitado}`,
      recurso: `InvitacionFinca:${invitacion.id_invitacion_finca}`,
    });

    return { message: 'Invitación reenviada correctamente.' };
  }

  async asignar_rol_usuario_finca(
    id_finca: number,
    id_usuario_finca: number,
    id_rol: number,
    actor: Usuario,
  ) {
    await this.require_finca(id_finca);

    const uf = await this.usuario_finca_repo.findOne({
      where: { id_usuario_finca },
      relations: ['finca', 'usuario', 'rol_finca'],
    });

    if (!uf || Number(uf.finca.id_finca) !== Number(id_finca)) {
      throw resourceNotFound();
    }

    const rol = await this.resolve_rol_finca_para_finca(id_finca, id_rol);
    uf.rol_finca = rol;
    uf.fecha_asociacion_rol = new Date();
    await this.usuario_finca_repo.save(uf);

    await this.log_service.registrar({
      usuario: actor,
      tipo_operacion: TipoOperacion.EXITO,
      descripcion: `Asignación de rol de finca ${rol.nombre_rol}`,
      recurso: `UsuarioFinca:${uf.id_usuario_finca}`,
    });

    return {
      message: 'Rol asignado correctamente.',
      id_usuario_finca: Number(uf.id_usuario_finca),
      id_rol: Number(rol.id_rol),
      nombre_rol: rol.nombre_rol,
    };
  }
}
