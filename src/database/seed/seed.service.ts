import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import {
  AmbitoPermiso,
  CODIGO_ADMIN_CROPLY,
  CODIGO_ADMIN_FINCA,
} from '../../common/enums';
import { hash_password } from '../../modules/auth/auth.crypto';
import { FincasService } from '../../modules/fincas/fincas.service';
import { RolesService } from '../../modules/roles/roles.service';
import { UsuariosService } from '../../modules/usuarios/usuarios.service';
import { Finca } from '../../modules/fincas/entities/finca.entity';
import { RolFinca } from '../../modules/roles/entities/rol.entity';
import { Usuario } from '../../modules/usuarios/entities/usuario.entity';
import {
  ADMIN_USUARIOS_SEED,
  SEED_ADMIN_DEFAULT_PASSWORD,
  SEED_ADMIN_ESTADO,
} from './admin-usuarios.seed';
import {
  ADMIN_FINCA_DEMO_SEED,
  EMPLEADOS_FINCA_DEMO_SEED,
  FINCAS_DEMO_SEED,
  FincaDemoUsuarioSeed,
  ROLES_FINCA_DEMO_SEED,
  SEED_FINCA_DEMO_ESTADO,
} from './finca-demo.seed';

@Injectable()
export class SeedService implements OnModuleInit {
  private readonly logger = new Logger(SeedService.name);

  constructor(
    private readonly usuarios_service: UsuariosService,
    private readonly roles_service: RolesService,
    private readonly fincas_service: FincasService,
    private readonly config: ConfigService,
  ) {}

  async onModuleInit(): Promise<void> {
    await this.seed_admin_usuarios();
    await this.seed_finca_demo();
  }

  async seed_admin_usuarios(): Promise<void> {
    await this.roles_service.ensure_seed_roles();

    const rol = await this.roles_service.find_rol_sistema_by_codigo(
      CODIGO_ADMIN_CROPLY,
    );
    if (!rol) {
      this.logger.warn(
        'No se pudo sembrar admins: falta rol ADMIN_CROPLY',
      );
      return;
    }

    const contrasena = await this.seed_password_hash();

    for (const admin of ADMIN_USUARIOS_SEED) {
      if (await this.usuarios_service.exists_by_email(admin.email)) {
        continue;
      }

      await this.usuarios_service.create({
        email: admin.email,
        nombre: admin.nombre,
        apellido: admin.apellido,
        telefono: admin.telefono,
        contrasena,
        estado: SEED_ADMIN_ESTADO,
        debe_cambiar_contrasena: false,
        rol_sistema: rol,
        fecha_baja: null,
      });

      this.logger.log(`Admin Croply sembrado: ${admin.email}`);
    }
  }

  /**
   * Finca(s) de desarrollo con su Admin de Finca y empleados, para poder
   * probar el ámbito finca sin depender de aprobar una digitalización.
   */
  async seed_finca_demo(): Promise<void> {
    await this.roles_service.ensure_seed_roles();

    const rol_admin_finca = await this.roles_service.find_rol_finca_by_codigo(
      CODIGO_ADMIN_FINCA,
    );
    if (!rol_admin_finca) {
      this.logger.warn(
        'No se pudo sembrar la finca demo: falta rol ADMIN_FINCA',
      );
      return;
    }

    const fincas: Finca[] = [];
    for (const datos of FINCAS_DEMO_SEED) {
      fincas.push(await this.ensure_finca(datos));
    }

    const admin = await this.ensure_usuario_demo(ADMIN_FINCA_DEMO_SEED);
    for (const finca of fincas) {
      await this.ensure_vinculacion(admin, finca, rol_admin_finca);
    }

    const finca_principal = fincas[0];
    const roles_finca = await this.ensure_roles_finca(finca_principal, admin);

    for (const datos of EMPLEADOS_FINCA_DEMO_SEED) {
      const rol = roles_finca.get(datos.nombre_rol ?? '');
      if (!rol) {
        continue;
      }
      const empleado = await this.ensure_usuario_demo(datos);
      await this.ensure_vinculacion(empleado, finca_principal, rol);
    }
  }

  private async ensure_finca(
    datos: (typeof FINCAS_DEMO_SEED)[number],
  ): Promise<Finca> {
    const existente = await this.fincas_service.find_finca_by_nombre(
      datos.nombre_finca,
    );
    if (existente) {
      return existente;
    }

    const finca = await this.fincas_service.crear_finca({
      nombre_finca: datos.nombre_finca,
      ubicacion_finca: datos.ubicacion_finca,
      superficie_finca: datos.superficie_finca,
      descripcion_finca: datos.descripcion_finca,
      fecha_baja_finca: null,
    });
    this.logger.log(`Finca demo sembrada: ${finca.nombre_finca}`);
    return finca;
  }

  private async ensure_roles_finca(
    finca: Finca,
    actor: Usuario,
  ): Promise<Map<string, RolFinca>> {
    const { permisos } = await this.roles_service.listar_permisos(
      AmbitoPermiso.FINCA,
    );
    const ids_permisos = permisos.map((p) => p.id_permiso);
    const resultado = new Map<string, RolFinca>();

    for (const datos of ROLES_FINCA_DEMO_SEED) {
      let rol = await this.roles_service.find_rol_finca_by_nombre(
        finca.id_finca,
        datos.nombre_rol,
      );

      if (!rol && ids_permisos.length > 0) {
        const creado = await this.roles_service.crear_rol_finca(
          finca.id_finca,
          {
            nombre_rol: datos.nombre_rol,
            descripcion: datos.descripcion,
            permisos: ids_permisos,
          },
          actor,
          finca,
        );
        rol = await this.roles_service.find_rol_finca_by_id(creado.id_rol);
        this.logger.log(
          `Rol de finca demo sembrado: ${datos.nombre_rol} (${finca.nombre_finca})`,
        );
      }

      if (rol) {
        resultado.set(datos.nombre_rol, rol);
      }
    }

    return resultado;
  }

  private async ensure_usuario_demo(
    datos: FincaDemoUsuarioSeed,
  ): Promise<Usuario> {
    const existente = await this.usuarios_service.find_by_email(datos.email);
    if (existente) {
      return existente;
    }

    const usuario = await this.usuarios_service.create({
      email: datos.email,
      nombre: datos.nombre,
      apellido: datos.apellido,
      telefono: datos.telefono,
      contrasena: await this.seed_password_hash(),
      estado: SEED_FINCA_DEMO_ESTADO,
      debe_cambiar_contrasena: false,
      rol_sistema: null,
      fecha_baja: null,
    });
    this.logger.log(`Usuario de finca demo sembrado: ${usuario.email}`);
    return usuario;
  }

  private async ensure_vinculacion(
    usuario: Usuario,
    finca: Finca,
    rol_finca: RolFinca,
  ): Promise<void> {
    const existente = await this.fincas_service.find_usuario_finca(
      usuario.id_usuario,
      finca.id_finca,
    );
    if (existente) {
      return;
    }

    await this.fincas_service.create_usuario_finca({
      usuario,
      finca,
      rol_finca,
    });
  }

  private async seed_password_hash(): Promise<string> {
    const plain_password =
      this.config.get<string>('SEED_ADMIN_PASSWORD') ??
      SEED_ADMIN_DEFAULT_PASSWORD;
    return hash_password(plain_password);
  }
}
