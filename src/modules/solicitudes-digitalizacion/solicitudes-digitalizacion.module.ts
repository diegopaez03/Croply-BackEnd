import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { AuthModule } from '../auth';
import { SolicitudDigitalizacionFinca } from './entities/solicitud-digitalizacion-finca.entity';
import { SolicitudesDigitalizacionService } from './solicitudes-digitalizacion.service';
import { SolicitudesDigitalizacionController } from './solicitudes-digitalizacion.controller';
import { OptionalJwtAuthGuard } from '../auth/guards/optional-jwt-auth.guard';

@Module({
  imports: [
    TypeOrmModule.forFeature([SolicitudDigitalizacionFinca]),
    AuthModule,
  ],
  controllers: [SolicitudesDigitalizacionController],
  providers: [SolicitudesDigitalizacionService, OptionalJwtAuthGuard],
  exports: [SolicitudesDigitalizacionService],
})
export class SolicitudesDigitalizacionModule {}
