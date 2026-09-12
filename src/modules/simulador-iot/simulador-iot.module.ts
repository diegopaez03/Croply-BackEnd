import { Module, forwardRef } from '@nestjs/common';
import { HttpModule } from '@nestjs/axios';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { ScheduleModule } from '@nestjs/schedule';
import { TypeOrmModule } from '@nestjs/typeorm';
import { AuthModule } from '../auth/auth.module';
import { ParcelasModule } from '../parcelas/parcelas.module';
import { ControladorSensor } from '../parcelas/entities/controlador-sensor.entity';
import { Parcela } from '../parcelas/entities/parcela.entity';
import { Sensor } from '../parcelas/entities/sensor.entity';
import { LecturaSensor } from './entities/lectura-sensor.entity';
import { SimuladorIotController } from './simulador-iot.controller';
import { SimuladorLecturaService } from './simulador-lectura.service';
import { SimuladorSincronizacionEstructuralService } from './simulador-sincronizacion-estructural.service';

@Module({
  imports: [
    ConfigModule,
    HttpModule.registerAsync({
      imports: [ConfigModule],
      inject: [ConfigService],
      useFactory: (config: ConfigService) => ({
        baseURL: config.get<string>('SIMULADOR_BASE_URL', '').replace(/\/$/, ''),
      }),
    }),
    ScheduleModule.forRoot(),
    TypeOrmModule.forFeature([Parcela, ControladorSensor, Sensor, LecturaSensor]),
    AuthModule,
    forwardRef(() => ParcelasModule),
  ],
  controllers: [SimuladorIotController],
  providers: [
    SimuladorSincronizacionEstructuralService,
    SimuladorLecturaService,
  ],
  exports: [SimuladorSincronizacionEstructuralService],
})
export class SimuladorIotModule {}
