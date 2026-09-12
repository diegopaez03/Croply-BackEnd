import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { CultivosModule } from '../cultivos';
import { ParcelasModule } from '../parcelas';
import { Hito } from './entities/hito.entity';
import { PlanAccion } from './entities/plan-accion.entity';
import { Tarea } from './entities/tarea.entity';
import { PlanesAccionController } from './planes-accion.controller';
import { PlanesAccionService } from './planes-accion.service';
import { Parcela } from '../parcelas/entities/parcela.entity';

@Module({
  imports: [
    TypeOrmModule.forFeature([PlanAccion, Hito, Tarea, Parcela]),
    CultivosModule,
    ParcelasModule,
  ],
  controllers: [PlanesAccionController],
  providers: [PlanesAccionService],
})
export class PlanesAccionModule {}
