import { Module, forwardRef } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { LogOperacionesModule } from '../log-operaciones';
import { Usuario } from '../usuarios/entities/usuario.entity';
import { UsuarioFinca } from '../fincas/entities/usuario-finca.entity';
import { AuthModule } from '../auth/auth.module';
import { Permiso } from './entities/permiso.entity';
import { RolPermiso } from './entities/rol-permiso.entity';
import { Rol, RolFinca, RolSistema } from './entities/rol.entity';
import { RolesController } from './roles.controller';
import { RolesService } from './roles.service';

@Module({
  imports: [
    TypeOrmModule.forFeature([
      Rol,
      RolSistema,
      RolFinca,
      Permiso,
      RolPermiso,
      Usuario,
      UsuarioFinca,
    ]),
    LogOperacionesModule,
    forwardRef(() => AuthModule),
  ],
  controllers: [RolesController],
  providers: [RolesService],
  exports: [RolesService, TypeOrmModule],
})
export class RolesModule {}
