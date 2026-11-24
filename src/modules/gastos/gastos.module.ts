import { Module, forwardRef } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { AuthModule } from '../auth/auth.module';
import { Finca } from '../fincas/entities/finca.entity';
import { UsuarioFinca } from '../fincas/entities/usuario-finca.entity';
import { LogOperacionesModule } from '../log-operaciones';
import { GastoProduccion } from './entities/gasto-produccion.entity';
import { GastosController } from './gastos.controller';
import { GastosService } from './gastos.service';

@Module({
  imports: [
    TypeOrmModule.forFeature([GastoProduccion, Finca, UsuarioFinca]),
    LogOperacionesModule,
    forwardRef(() => AuthModule),
  ],
  controllers: [GastosController],
  providers: [GastosService],
  exports: [GastosService],
})
export class GastosModule {}
