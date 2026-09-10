import { HttpStatus, Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { IsNull, MoreThan, Repository } from 'typeorm';
import {
  CODIGO_ADMIN_FINCA,
  EstadoInvitacion,
  EstadoUsuario,
  TipoOperacion,
} from '../../common/enums';
import {
  DomainException,
  resourceNotFound,
} from '../../common/exceptions';
import { generate_token, hash_token } from '../auth/auth.crypto';
import { MailerService } from '../../common/mailer';
import { LogOperacionesService } from '../log-operaciones';
import { RolesService } from '../roles/roles.service';
import { Usuario } from '../usuarios/entities/usuario.entity';
import { Finca } from './entities/finca.entity';
import { InvitacionFinca } from './entities/invitacion-finca.entity';
import { UsuarioFinca } from './entities/usuario-finca.entity';
import { RolFinca } from '../roles/entities/rol.entity';
import { CrearInvitacionDto } from './dto/fincas.dto';

const INVITATION_TTL_DAYS = 7;

@Injectable()
export class FincasService {
  constructor(
    @InjectRepository(Finca)
    private readonly finca_repo: Repository<Finca>,
    @InjectRepository(UsuarioFinca)
    private readonly usuario_finca_repo: Repository<UsuarioFinca>,
    @InjectRepository(InvitacionFinca)
    private readonly invitacion_repo: Repository<InvitacionFinca>,
    private readonly roles_service: RolesService,
    private readonly mailer: MailerService,
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
    const ids = this.vinculaciones_vigentes(usuario).map((uf) =>
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
