import { Module, forwardRef } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { MailerModule } from '../../common/mailer';
import { AuthModule } from '../auth/auth.module';
import { LogOperacionesModule } from '../log-operaciones';
import { RolesModule } from '../roles';
import { UsuariosModule } from '../usuarios';
import { Finca } from './entities/finca.entity';
import { InvitacionFinca } from './entities/invitacion-finca.entity';
import { UsuarioFinca } from './entities/usuario-finca.entity';
import { FincasController } from './fincas.controller';
import { FincasService } from './fincas.service';
import { InvitacionesController } from './invitaciones.controller';

@Module({
  imports: [
    TypeOrmModule.forFeature([Finca, UsuarioFinca, InvitacionFinca]),
    LogOperacionesModule,
    forwardRef(() => RolesModule),
    forwardRef(() => UsuariosModule),
    forwardRef(() => AuthModule),
    MailerModule,
  ],
  controllers: [FincasController, InvitacionesController],
  providers: [FincasService],
  exports: [FincasService, TypeOrmModule],
})
export class FincasModule {}
