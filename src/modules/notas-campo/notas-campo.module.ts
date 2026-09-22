import { Module, forwardRef } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { AuthModule } from '../auth/auth.module';
import { UsuarioFinca } from '../fincas/entities/usuario-finca.entity';
import { Finca } from '../fincas/entities/finca.entity';
import { PlanesAccionModule } from '../planes-accion/planes-accion.module';
import { Hito } from '../planes-accion/entities/hito.entity';
import { PlanAccion } from '../planes-accion/entities/plan-accion.entity';
import { Parcela } from '../parcelas/entities/parcela.entity';
import { NotaCampo } from './entities/nota-campo.entity';
import { MembresiaFincaPorParcelaGuard } from './guards/membresia-finca-por-parcela.guard';
import {
  NotasCampoController,
  NotasCampoFincaController,
  NotasCampoParcelaController,
} from './notas-campo.controller';
import { NotasCampoService } from './notas-campo.service';

@Module({
  imports: [
    TypeOrmModule.forFeature([
      NotaCampo,
      Finca,
      Parcela,
      UsuarioFinca,
      PlanAccion,
      Hito,
    ]),
    forwardRef(() => AuthModule),
    forwardRef(() => PlanesAccionModule),
  ],
  controllers: [
    NotasCampoController,
    NotasCampoFincaController,
    NotasCampoParcelaController,
  ],
  providers: [NotasCampoService, MembresiaFincaPorParcelaGuard],
})
export class NotasCampoModule {}
