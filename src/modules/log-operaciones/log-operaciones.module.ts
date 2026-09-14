import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { LogOperaciones } from './entities/log-operaciones.entity';
import { LogOperacionesService } from './log-operaciones.service';

@Module({
  imports: [TypeOrmModule.forFeature([LogOperaciones])],
  providers: [LogOperacionesService],
  exports: [LogOperacionesService],
})
export class LogOperacionesModule {}
