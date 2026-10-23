import { Module, forwardRef } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { AuthModule } from '../auth/auth.module';
import { FincasModule } from '../fincas/fincas.module';
import { PlanAccion } from '../planes-accion/entities/plan-accion.entity';
import { RecomendacionesModule } from '../recomendaciones/recomendaciones.module';
import { AlertasClimaticasController } from './alertas-climaticas.controller';
import { AlertasClimaticasCronService } from './alertas-climaticas-cron.service';
import { AlertaClimatica } from './entities/alerta-climatica.entity';
import { Notificacion } from './entities/notificacion.entity';

@Module({
  imports: [
    TypeOrmModule.forFeature([AlertaClimatica, Notificacion, PlanAccion]),
    forwardRef(() => FincasModule),
    forwardRef(() => AuthModule),
    RecomendacionesModule,
  ],
  controllers: [AlertasClimaticasController],
  providers: [AlertasClimaticasCronService],
})
export class AlertasClimaticasModule {}
