import { Module, forwardRef } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { AuthModule } from '../auth/auth.module';
import { Finca } from '../fincas/entities/finca.entity';
import { UsuarioFinca } from '../fincas/entities/usuario-finca.entity';
import { Sensor } from '../parcelas/entities/sensor.entity';
import { Usuario } from '../usuarios/entities/usuario.entity';
import { TableroGlobalController } from './tablero-global.controller';
import { TableroGlobalService } from './tablero-global.service';

@Module({
  imports: [
    TypeOrmModule.forFeature([Finca, Sensor, UsuarioFinca, Usuario]),
    forwardRef(() => AuthModule),
  ],
  controllers: [TableroGlobalController],
  providers: [TableroGlobalService],
  exports: [TableroGlobalService],
})
export class TableroGlobalModule {}
