import { HttpStatus, Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';
import { InjectRepository } from '@nestjs/typeorm';
import { IsNull, Repository } from 'typeorm';
import {
  DomainException,
  duplicateValue,
} from '../../common/exceptions';
import {
  CODIGO_ADMIN_CROPLY,
  EstadoInvitacion,
  EstadoUsuario,
} from '../../common/enums';
import { MailerStubService } from '../../common/mailer';
import { UsuariosService } from '../usuarios/usuarios.service';
import { FincasService } from '../fincas/fincas.service';
import { RolesService } from '../roles/roles.service';
import { Usuario } from '../usuarios/entities/usuario.entity';
import { ResetsContrasena } from './entities/resets-contrasena.entity';
import {
  compare_password,
  compare_token,
  generate_token,
  hash_password,
  hash_token,
  parse_expires_in_seconds,
} from './auth.crypto';
import { LoginDto } from './dto/login.dto';
import { RegistrarAdminFincaDto } from './dto/registrar-admin-finca.dto';
import { RegistrarInvitadoDto } from './dto/registrar-invitado.dto';
import { OlvideMiContrasenaDto } from './dto/olvide-mi-contrasena.dto';
import { ResetearContrasenaDto } from './dto/resetear-contrasena.dto';
import { CambioContrasenaDto } from './dto/cambio-contrasena.dto';
import { ContrasenaPrimerAccesoDto } from './dto/contrasena-primer-acceso.dto';

const RESET_TOKEN_TTL_HOURS = 24;

export interface AuthJwtPayload {
  sub: number;
  email: string;
  debe_cambiar_contrasena: boolean;
  rol_sistema: string | null;
}

@Injectable()
export class AuthService {
  constructor(
    private readonly usuarios_service: UsuariosService,
    private readonly fincas_service: FincasService,
    private readonly roles_service: RolesService,
    private readonly jwt_service: JwtService,
    private readonly config: ConfigService,
    private readonly mailer: MailerStubService,
    @InjectRepository(ResetsContrasena)
    private readonly resets_repo: Repository<ResetsContrasena>,
  ) {}

  async login(dto: LoginDto) {
    const usuario = await this.usuarios_service.find_by_email(dto.email);
    if (!usuario) {
      throw this.invalid_credentials();
    }

    const password_ok = await compare_password(dto.contrasena, usuario.contrasena);
    if (!password_ok) {
      throw this.invalid_credentials();
    }

    if (
      usuario.estado === EstadoUsuario.INACTIVO ||
      (usuario.estado === EstadoUsuario.PENDIENTE &&
        !usuario.debe_cambiar_contrasena)
    ) {
      throw new DomainException(
        'ACCOUNT_NOT_ACTIVE',
        'Tu cuenta no se encuentra activa. Contactá al administrador.',
        HttpStatus.FORBIDDEN,
      );
    }

    const expires_in_raw = this.config.get<string>('JWT_EXPIRES_IN', '1h');
    const expiresIn = parse_expires_in_seconds(expires_in_raw);
    const accessToken = await this.jwt_service.signAsync(
      this.build_jwt_payload(usuario),
      { expiresIn: expires_in_raw as number | `${number}${'s' | 'm' | 'h' | 'd'}` },
    );

    return {
      accessToken,
      expiresIn,
      debe_cambiar_contrasena: usuario.debe_cambiar_contrasena,
      usuario: this.map_usuario_login(usuario),
    };
  }

  async registrar_admin_finca(dto: RegistrarAdminFincaDto) {
    if (await this.usuarios_service.exists_by_email(dto.email)) {
      throw duplicateValue('email');
    }

    let rol_sistema = null;
    if (dto.id_Rol != null) {
      rol_sistema = await this.roles_service.find_rol_sistema_by_id(dto.id_Rol);
    }

    const usuario = await this.usuarios_service.create({
      email: dto.email,
      nombre: dto.nombre,
      apellido: dto.apellido,
      telefono: dto.telefono ?? null,
      contrasena: await hash_password(dto.contrasena_temporal),
      estado: dto.estado,
      debe_cambiar_contrasena: true,
      rol_sistema,
      fecha_baja: null,
    });

    return {
      message: 'Usuario registrado correctamente',
      id_Usuario: Number(usuario.id_usuario),
      email: usuario.email,
      nombre: usuario.nombre,
      apellido: usuario.apellido,
      telefono: usuario.telefono,
      estado: usuario.estado,
      id_Rol: usuario.rol_sistema ? Number(usuario.rol_sistema.id_rol) : null,
      fecha_alta: usuario.fecha_alta.toISOString(),
      fecha_baja: usuario.fecha_baja,
    };
  }

  async validar_invitacion(token: string) {
    const invitacion = await this.find_invitacion_by_token(token);
    if (!invitacion) {
      throw new DomainException(
        'INVITATION_EXPIRED',
        'Este enlace de invitación no es válido o ha expirado. Contactá al administrador.',
        HttpStatus.GONE,
      );
    }

    if (
      invitacion.estado === EstadoInvitacion.ACEPTADA ||
      invitacion.usuario_registrado != null ||
      invitacion.fecha_respuesta != null
    ) {
      throw new DomainException(
        'INVITATION_ALREADY_USED',
        'Este enlace de invitación ya fue utilizado. Contactá al administrador.',
        HttpStatus.GONE,
      );
    }

    if (invitacion.fecha_fin_vigencia.getTime() < Date.now()) {
      throw new DomainException(
        'INVITATION_EXPIRED',
        'Este enlace de invitación no es válido o ha expirado. Contactá al administrador.',
        HttpStatus.GONE,
      );
    }

    return {
      valido: true,
      email_invitado: invitacion.email_invitado,
      id_InvitacionFinca: Number(invitacion.id_invitacion_finca),
    };
  }

  async registrar_invitado(dto: RegistrarInvitadoDto) {
    const invitacion = await this.fincas_service.find_invitacion_by_id(
      dto.id_InvitacionFinca,
    );

    if (
      !invitacion ||
      invitacion.estado !== EstadoInvitacion.PENDIENTE ||
      invitacion.fecha_fin_vigencia.getTime() < Date.now()
    ) {
      throw new DomainException(
        'INVITATION_EXPIRED',
        'Este enlace de invitación no es válido o ha expirado. Contactá al administrador.',
        HttpStatus.GONE,
      );
    }

    if (invitacion.usuario_registrado != null || invitacion.fecha_respuesta) {
      throw new DomainException(
        'INVITATION_ALREADY_USED',
        'Este enlace de invitación ya fue utilizado. Contactá al administrador.',
        HttpStatus.GONE,
      );
    }

    if (await this.usuarios_service.exists_by_email(invitacion.email_invitado)) {
      throw duplicateValue('email');
    }

    const usuario = await this.usuarios_service.create({
      email: invitacion.email_invitado,
      nombre: dto.nombre,
      apellido: dto.apellido,
      telefono: null,
      contrasena: await hash_password(dto.contrasena),
      estado: EstadoUsuario.ACTIVO,
      debe_cambiar_contrasena: false,
      rol_sistema: null,
      fecha_baja: null,
    });

    await this.fincas_service.create_usuario_finca({
      usuario,
      finca: invitacion.finca,
      rol_finca: invitacion.rol_finca,
    });

    invitacion.estado = EstadoInvitacion.ACEPTADA;
    invitacion.fecha_respuesta = new Date();
    invitacion.usuario_registrado = usuario;
    await this.fincas_service.save_invitacion(invitacion);

    return {
      message: 'Registro completado con éxito.',
      usuario: {
        id_Usuario: Number(usuario.id_usuario),
        email: usuario.email,
        nombre: usuario.nombre,
        apellido: usuario.apellido,
        estado: usuario.estado,
        fecha_alta: usuario.fecha_alta.toISOString(),
      },
    };
  }

  async olvide_mi_contrasena(dto: OlvideMiContrasenaDto) {
    const message =
      'Si el correo ingresado está registrado, recibirás un enlace para restablecer tu contraseña.';

    const usuario = await this.usuarios_service.find_by_email(dto.email);
    if (!usuario) {
      return { message };
    }

    const token = generate_token();
    const token_hash = await hash_token(token);
    const fecha_fin_vigencia = new Date();
    fecha_fin_vigencia.setHours(
      fecha_fin_vigencia.getHours() + RESET_TOKEN_TTL_HOURS,
    );

    await this.resets_repo.save(
      this.resets_repo.create({
        token_hash,
        fecha_fin_vigencia,
        fecha_uso: null,
        usuario,
      }),
    );

    await this.mailer.send_password_reset(usuario.email, token);
    return { message };
  }

  async resetear_contrasena(dto: ResetearContrasenaDto) {
    if (dto.nueva_contrasena !== dto.confirmar_contrasena) {
      throw new DomainException(
        'PASSWORD_MISMATCH',
        'Las contraseñas no coinciden',
        HttpStatus.BAD_REQUEST,
      );
    }

    const resets = await this.resets_repo.find({
      where: { fecha_uso: IsNull() },
      relations: ['usuario'],
      order: { fecha_alta: 'DESC' },
      take: 100,
    });

    let matched: ResetsContrasena | null = null;
    for (const reset of resets) {
      if (await compare_token(dto.token_hash, reset.token_hash)) {
        matched = reset;
        break;
      }
    }

    if (
      !matched ||
      matched.fecha_uso != null ||
      matched.fecha_fin_vigencia.getTime() < Date.now()
    ) {
      throw new DomainException(
        'TOKEN_EXPIRED',
        'Este enlace de recuperación no es válido o ha expirado. Solicitá uno nuevo.',
        HttpStatus.GONE,
      );
    }

    matched.usuario.contrasena = await hash_password(dto.nueva_contrasena);
    matched.usuario.debe_cambiar_contrasena = false;
    await this.usuarios_service.save(matched.usuario);

    matched.fecha_uso = new Date();
    await this.resets_repo.save(matched);

    return {
      success: true,
      message:
        'Tu contraseña fue restablecida correctamente. Podés iniciar sesión.',
    };
  }

  async cambio_contrasena(id_usuario: number, dto: CambioContrasenaDto) {
    if (dto.nueva_contrasena !== dto.confirmar_contrasena) {
      throw new DomainException(
        'PASSWORD_MISMATCH',
        'Las contraseñas no coinciden',
        HttpStatus.BAD_REQUEST,
      );
    }

    const usuario = await this.usuarios_service.find_by_id(id_usuario);
    if (!usuario) {
      throw this.invalid_credentials();
    }

    const ok = await compare_password(dto.contrasena_actual, usuario.contrasena);
    if (!ok) {
      throw new DomainException(
        'CURRENT_PASSWORD_INCORRECT',
        'La contraseña actual es incorrecta',
        HttpStatus.BAD_REQUEST,
      );
    }

    usuario.contrasena = await hash_password(dto.nueva_contrasena);
    await this.usuarios_service.save(usuario);

    return {
      success: true,
      message: 'Tu contraseña fue actualizada correctamente.',
    };
  }

  async contrasena_primer_acceso(
    id_usuario: number,
    dto: ContrasenaPrimerAccesoDto,
  ) {
    if (dto.nueva_contrasena !== dto.confirmar_contrasena) {
      throw new DomainException(
        'PASSWORD_MISMATCH',
        'Las contraseñas no coinciden',
        HttpStatus.BAD_REQUEST,
      );
    }

    const usuario = await this.usuarios_service.find_by_id(id_usuario);
    if (!usuario) {
      throw this.invalid_credentials();
    }

    usuario.contrasena = await hash_password(dto.nueva_contrasena);
    usuario.debe_cambiar_contrasena = false;
    usuario.estado = EstadoUsuario.ACTIVO;
    await this.usuarios_service.save(usuario);

    return {
      success: true,
      message:
        'Contraseña configurada con éxito. Su cuenta ya se encuentra activa.',
    };
  }

  assert_admin_croply(usuario: Usuario): void {
    if (usuario.rol_sistema?.codigo !== CODIGO_ADMIN_CROPLY) {
      throw new DomainException(
        'FORBIDDEN',
        'No tenés permisos para realizar esta acción',
        HttpStatus.FORBIDDEN,
      );
    }
  }

  private async find_invitacion_by_token(token: string) {
    const invitaciones = await this.fincas_service.find_all_invitaciones();
    for (const invitacion of invitaciones) {
      if (await compare_token(token, invitacion.token_hash)) {
        return invitacion;
      }
    }
    return null;
  }

  private build_jwt_payload(usuario: Usuario): AuthJwtPayload {
    return {
      sub: Number(usuario.id_usuario),
      email: usuario.email,
      debe_cambiar_contrasena: usuario.debe_cambiar_contrasena,
      rol_sistema: usuario.rol_sistema?.codigo ?? null,
    };
  }

  private map_usuario_login(usuario: Usuario) {
    const now = Date.now();
    const fincas = (usuario.usuario_fincas ?? [])
      .filter(
        (uf) =>
          uf.fecha_fin_rol == null || uf.fecha_fin_rol.getTime() > now,
      )
      .map((uf) => ({
        id_Finca: Number(uf.finca.id_finca),
        nombre_finca: uf.finca.nombre_finca,
        rol_finca: uf.rol_finca.codigo_rol_finca,
      }));

    return {
      id_Usuario: Number(usuario.id_usuario),
      email: usuario.email,
      nombre: usuario.nombre,
      apellido: usuario.apellido,
      estado: usuario.estado,
      fecha_alta: usuario.fecha_alta.toISOString(),
      rol_sistema: usuario.rol_sistema?.codigo ?? null,
      fincas,
    };
  }

  private invalid_credentials(): DomainException {
    return new DomainException(
      'INVALID_CREDENTIALS',
      'Correo electrónico o contraseña incorrectos',
      HttpStatus.UNAUTHORIZED,
    );
  }
}
