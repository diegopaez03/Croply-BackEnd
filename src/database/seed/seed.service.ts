import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { CODIGO_ADMIN_CROPLY } from '../../common/enums';
import { hash_password } from '../../modules/auth/auth.crypto';
import { RolesService } from '../../modules/roles/roles.service';
import { UsuariosService } from '../../modules/usuarios/usuarios.service';
import {
  ADMIN_USUARIOS_SEED,
  SEED_ADMIN_DEFAULT_PASSWORD,
  SEED_ADMIN_ESTADO,
} from './admin-usuarios.seed';

@Injectable()
export class SeedService implements OnModuleInit {
  private readonly logger = new Logger(SeedService.name);

  constructor(
    private readonly usuarios_service: UsuariosService,
    private readonly roles_service: RolesService,
    private readonly config: ConfigService,
  ) {}

  async onModuleInit(): Promise<void> {
    await this.seed_admin_usuarios();
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

    const plain_password =
      this.config.get<string>('SEED_ADMIN_PASSWORD') ??
      SEED_ADMIN_DEFAULT_PASSWORD;
    const contrasena = await hash_password(plain_password);

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
}
