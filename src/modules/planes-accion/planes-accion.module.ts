import { Module, forwardRef } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { AuthModule } from '../auth/auth.module';
import { CultivosModule } from '../cultivos';
import { FincasModule } from '../fincas';
import { ParcelasModule } from '../parcelas';
import { EstadosTareaModule } from '../estados-tarea';
import { UsuarioFinca } from '../fincas/entities/usuario-finca.entity';
import { Parcela } from '../parcelas/entities/parcela.entity';
import { TiposTareaModule } from '../tipos-tarea';
import { AplicacionAgroquimico } from './entities/aplicacion-agroquimico.entity';
import { Hito } from './entities/hito.entity';
import { PlanAccion } from './entities/plan-accion.entity';
import { Tarea } from './entities/tarea.entity';
import { AlcanceFincaPorPlanGuard } from './guards/alcance-finca-por-plan.guard';
import { PlanesAccionController } from './planes-accion.controller';
import { PlanesAccionCronogramaController } from './planes-accion.cronograma.controller';
import { PlanesAccionService } from './planes-accion.service';

@Module({
  imports: [
    TypeOrmModule.forFeature([
      PlanAccion,
      Hito,
      Tarea,
      AplicacionAgroquimico,
      Parcela,
      UsuarioFinca,
    ]),
    forwardRef(() => AuthModule),
    CultivosModule,
    forwardRef(() => FincasModule),
    forwardRef(() => ParcelasModule),
    TiposTareaModule,
    EstadosTareaModule,
  ],
  controllers: [PlanesAccionController, PlanesAccionCronogramaController],
  providers: [PlanesAccionService, AlcanceFincaPorPlanGuard],
  exports: [PlanesAccionService],
})
export class PlanesAccionModule {}
