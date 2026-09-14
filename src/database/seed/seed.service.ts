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
import { CultivosBaseService } from '../../modules/cultivos/cultivos-base.service';
import { PlantillasBaseService } from '../../modules/cultivos/plantillas-base.service';
import { Finca } from '../../modules/fincas/entities/finca.entity';
import { RolFinca } from '../../modules/roles/entities/rol.entity';
import { Usuario } from '../../modules/usuarios/entities/usuario.entity';
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
    private readonly fincas_service: FincasService,
    private readonly cultivos_service: CultivosBaseService,
    private readonly plantillas_service: PlantillasBaseService,
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

  private async seed_password_hash(): Promise<string> {
    const plain_password =
      this.config.get<string>('SEED_ADMIN_PASSWORD') ??
      SEED_ADMIN_DEFAULT_PASSWORD;
    return hash_password(plain_password);
  }
}
