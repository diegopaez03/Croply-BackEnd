import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { AuthModule } from '../auth/auth.module';
import { LogOperacionesModule } from '../log-operaciones';
import { CultivosBaseController } from './cultivos-base.controller';
import { CultivosBaseService } from './cultivos-base.service';
import { CultivoBase } from './entities/cultivo-base.entity';
import { HitoPlantilla } from './entities/hito-plantilla.entity';
import { PlantillaBase } from './entities/plantilla-base.entity';
import { PlantillaCultivoVariedad } from './entities/plantilla-cultivo-variedad.entity';
import { TareaPlantilla } from './entities/tarea-plantilla.entity';
import { Variedad } from './entities/variedad.entity';
import { PlantillasBaseController } from './plantillas-base.controller';
import { PlantillasBaseService } from './plantillas-base.service';

@Module({
  imports: [
    TypeOrmModule.forFeature([
      CultivoBase,
      Variedad,
      PlantillaBase,
      PlantillaCultivoVariedad,
      HitoPlantilla,
      TareaPlantilla,
    ]),
    LogOperacionesModule,
    AuthModule,
  ],
  controllers: [CultivosBaseController, PlantillasBaseController],
  providers: [CultivosBaseService, PlantillasBaseService],
  exports: [CultivosBaseService, PlantillasBaseService, TypeOrmModule],
})
export class CultivosModule {}
