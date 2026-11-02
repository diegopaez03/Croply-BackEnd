import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Notificacion } from '../alertas-climaticas/entities/notificacion.entity';
import { AuthModule } from '../auth/auth.module';
import { Tarea } from '../planes-accion/entities/tarea.entity';
import { NotificacionesController } from './notificaciones.controller';
import { NotificacionesService } from './notificaciones.service';

@Module({
  imports: [
    TypeOrmModule.forFeature([Notificacion, Tarea]),
    AuthModule,
  ],
  controllers: [NotificacionesController],
  providers: [NotificacionesService],
})
export class NotificacionesModule {}
