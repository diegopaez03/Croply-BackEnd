import { Module, forwardRef } from '@nestjs/common';
import { HttpModule } from '@nestjs/axios';
import { TypeOrmModule } from '@nestjs/typeorm';
import { AuthModule } from '../auth/auth.module';
import { FincasModule } from '../fincas/fincas.module';
import { ParcelasModule } from '../parcelas/parcelas.module';
import { AiIntegrationService } from './ai-integration.service';
import { RecomendacionIa } from './entities/recomendacion-ia.entity';
import { RecomendacionesIaController } from './recomendaciones-ia.controller';
import { RecomendacionesIaService } from './recomendaciones-ia.service';

@Module({
  imports: [
    HttpModule,
    TypeOrmModule.forFeature([RecomendacionIa]),
    forwardRef(() => ParcelasModule),
    forwardRef(() => FincasModule),
    forwardRef(() => AuthModule),
  ],
  controllers: [RecomendacionesIaController],
  providers: [RecomendacionesIaService, AiIntegrationService],
  exports: [AiIntegrationService],
})
export class RecomendacionesModule {}
