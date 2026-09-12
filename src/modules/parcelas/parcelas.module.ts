import { Module, forwardRef } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { FincasModule } from '../fincas';
import { TiposSensorModule } from '../tipos-sensor';
import { AdminFincaPorParcelaGuard } from '../auth/guards/admin-finca-por-parcela.guard';
import { ControladorSensor } from './entities/controlador-sensor.entity';
import { Parcela } from './entities/parcela.entity';
import { Sensor } from './entities/sensor.entity';
import { CodigoQR } from './entities/codigo-qr.entity';
import { ParcelasController } from './parcelas.controller';
import { CodigoQrController } from './codigo-qr.controller';
import { ParcelasService } from './parcelas.service';
import { SimuladorIotModule } from '../simulador-iot/simulador-iot.module';
import { PlanAccion } from '../planes-accion/entities/plan-accion.entity';
import { ParcelaDetalleController } from './parcela-detalle.controller';
import { ParcelaResumenController } from './parcela-resumen.controller';

@Module({
  imports: [
    TypeOrmModule.forFeature([Parcela, ControladorSensor, Sensor, CodigoQR, PlanAccion]),
    forwardRef(() => FincasModule),
    TiposSensorModule,
    forwardRef(() => SimuladorIotModule),
  ],
  controllers: [
    ParcelasController,
    CodigoQrController,
    ParcelaDetalleController,
    ParcelaResumenController,
  ],
  providers: [ParcelasService, AdminFincaPorParcelaGuard],
  exports: [ParcelasService, AdminFincaPorParcelaGuard, TypeOrmModule],
})
export class ParcelasModule {}
