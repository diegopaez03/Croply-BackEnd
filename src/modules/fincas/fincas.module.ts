import { Module, forwardRef } from '@nestjs/common';
import { HttpModule } from '@nestjs/axios';
import { TypeOrmModule } from '@nestjs/typeorm';
import { AuthModule } from '../auth/auth.module';
import { LogOperacionesModule } from '../log-operaciones';
import { RolesModule } from '../roles';
import { UsuariosModule } from '../usuarios';
import { Finca } from './entities/finca.entity';
import { InvitacionFinca } from './entities/invitacion-finca.entity';
import { UsuarioFinca } from './entities/usuario-finca.entity';
import { Usuario } from '../usuarios/entities/usuario.entity';
import { Parcela } from '../parcelas/entities/parcela.entity';
import { Sensor } from '../parcelas/entities/sensor.entity';
import { FincasController } from './fincas.controller';
import { FincasService } from './fincas.service';
import { InvitacionesController } from './invitaciones.controller';
import { ClimaService } from './clima.service';
import { MiFincaController } from './mi-finca.controller';

@Module({
  imports: [
    HttpModule,
    TypeOrmModule.forFeature([
      Finca,
      UsuarioFinca,
      InvitacionFinca,
      Usuario,
      Parcela,
      Sensor,
    ]),
    LogOperacionesModule,
    forwardRef(() => RolesModule),
    forwardRef(() => UsuariosModule),
    forwardRef(() => AuthModule),
  ],
  controllers: [FincasController, InvitacionesController, MiFincaController],
  providers: [FincasService, ClimaService],
  exports: [FincasService, TypeOrmModule],
})
export class FincasModule {}
