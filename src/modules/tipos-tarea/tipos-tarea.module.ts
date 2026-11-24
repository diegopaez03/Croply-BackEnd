import { Module, forwardRef } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { AuthModule } from '../auth/auth.module';
import { TareaPlantilla } from '../cultivos/entities/tarea-plantilla.entity';
import { LogOperacionesModule } from '../log-operaciones';
import { Tarea } from '../planes-accion/entities/tarea.entity';
import { TipoTarea } from './entities/tipo-tarea.entity';
import { TiposTareaController } from './tipos-tarea.controller';
import { TiposTareaService } from './tipos-tarea.service';

@Module({
  imports: [
    TypeOrmModule.forFeature([TipoTarea, Tarea, TareaPlantilla]),
    LogOperacionesModule,
    forwardRef(() => AuthModule),
  ],
  controllers: [TiposTareaController],
  providers: [TiposTareaService],
  exports: [TiposTareaService, TypeOrmModule],
})
export class TiposTareaModule {}
