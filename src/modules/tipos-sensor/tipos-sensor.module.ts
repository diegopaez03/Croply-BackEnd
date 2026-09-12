import { Module, forwardRef } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { LogOperacionesModule } from '../log-operaciones';
import { AuthModule } from '../auth/auth.module';
import { Sensor } from '../parcelas/entities/sensor.entity';
import { TiposSensorController } from './tipos-sensor.controller';
import { TipoSensor } from './entities/tipo-sensor.entity';
import { TiposSensorService } from './tipos-sensor.service';

@Module({
  imports: [
    TypeOrmModule.forFeature([TipoSensor, Sensor]),
    LogOperacionesModule,
    forwardRef(() => AuthModule),
  ],
  controllers: [TiposSensorController],
  providers: [TiposSensorService],
  exports: [TiposSensorService],
})
export class TiposSensorModule {}
