import { Module, forwardRef } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { AuthModule } from '../auth/auth.module';
import { LogOperacionesModule } from '../log-operaciones';
import { Tarea } from '../planes-accion/entities/tarea.entity';
import { EstadoTarea } from './entities/estado-tarea.entity';
import { EstadosTareaController } from './estados-tarea.controller';
import { EstadosTareaService } from './estados-tarea.service';

@Module({
  imports: [
    TypeOrmModule.forFeature([EstadoTarea, Tarea]),
    LogOperacionesModule,
    forwardRef(() => AuthModule),
  ],
  controllers: [EstadosTareaController],
  providers: [EstadosTareaService],
  exports: [EstadosTareaService, TypeOrmModule],
})
export class EstadosTareaModule {}
