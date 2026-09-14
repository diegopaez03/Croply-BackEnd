import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { AuthModule } from '../auth/auth.module';
import { CultivosModule } from '../cultivos';
import { FincasModule } from '../fincas';
import { ParcelasModule } from '../parcelas';
import { UsuarioFinca } from '../fincas/entities/usuario-finca.entity';
import { Parcela } from '../parcelas/entities/parcela.entity';
import { Hito } from './entities/hito.entity';
import { PlanAccion } from './entities/plan-accion.entity';
import { Tarea } from './entities/tarea.entity';
import { AlcanceFincaPorPlanGuard } from './guards/alcance-finca-por-plan.guard';
import { PlanesAccionController } from './planes-accion.controller';
import { PlanesAccionCronogramaController } from './planes-accion.cronograma.controller';
import { PlanesAccionService } from './planes-accion.service';

@Module({
  imports: [
    TypeOrmModule.forFeature([PlanAccion, Hito, Tarea, Parcela, UsuarioFinca]),
    AuthModule,
    CultivosModule,
    FincasModule,
    ParcelasModule,
  ],
  controllers: [PlanesAccionController, PlanesAccionCronogramaController],
  providers: [PlanesAccionService, AlcanceFincaPorPlanGuard],
})
export class PlanesAccionModule {}
