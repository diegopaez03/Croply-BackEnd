import { Module, forwardRef } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { AuthModule } from '../auth/auth.module';
import { LogOperacionesModule } from '../log-operaciones';
import { PreguntaFrecuente } from './entities/pregunta-frecuente.entity';
import { PreguntasFrecuentesController } from './preguntas-frecuentes.controller';
import { PreguntasFrecuentesService } from './preguntas-frecuentes.service';
import { SoporteController } from './soporte.controller';
import { SoporteService } from './soporte.service';

@Module({
  imports: [
    TypeOrmModule.forFeature([PreguntaFrecuente]),
    LogOperacionesModule,
    forwardRef(() => AuthModule),
  ],
  controllers: [PreguntasFrecuentesController, SoporteController],
  providers: [PreguntasFrecuentesService, SoporteService],
  exports: [PreguntasFrecuentesService, SoporteService],
})
export class PreguntasFrecuentesModule {}
