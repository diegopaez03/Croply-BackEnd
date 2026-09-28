import { Module, forwardRef } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { AuthModule } from '../auth/auth.module';
import { Finca } from '../fincas/entities/finca.entity';
import { UsuarioFinca } from '../fincas/entities/usuario-finca.entity';
import { LogOperacionesModule } from '../log-operaciones';
import { Parcela } from '../parcelas/entities/parcela.entity';
import { PlanesAccionModule } from '../planes-accion';
import { AplicacionAgroquimico } from '../planes-accion/entities/aplicacion-agroquimico.entity';
import { Hito } from '../planes-accion/entities/hito.entity';
import { PlanAccion } from '../planes-accion/entities/plan-accion.entity';
import { TiposTareaModule } from '../tipos-tarea';
import { AgroquimicosController } from './agroquimicos.controller';
import { AgroquimicosService } from './agroquimicos.service';

@Module({
  imports: [
    TypeOrmModule.forFeature([
      AplicacionAgroquimico,
      Parcela,
      PlanAccion,
      Hito,
      UsuarioFinca,
      Finca,
    ]),
    forwardRef(() => AuthModule),
    PlanesAccionModule,
    TiposTareaModule,
    LogOperacionesModule,
  ],
  controllers: [AgroquimicosController],
  providers: [AgroquimicosService],
})
export class AgroquimicosModule {}
