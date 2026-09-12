import {
  Controller,
  Get,
  Param,
  ParseIntPipe,
  UseGuards,
} from '@nestjs/common';
import { ApiOkResponse, ApiOperation, ApiTags } from '@nestjs/swagger';
import { ApiAuth, ApiErrorResponses } from '../../common/decorators';
import { SWAGGER_TAGS } from '../../common/swagger';
import { AdminFincaPorParcelaGuard } from '../auth/guards/admin-finca-por-parcela.guard';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { SimuladorLecturaService } from './simulador-lectura.service';

@ApiTags(SWAGGER_TAGS.PARCELAS)
@Controller('parcelas')
export class SimuladorIotController {
  constructor(private readonly lectura_service: SimuladorLecturaService) {}

  @Get(':id_parcela/monitoreo-sensores')
  @UseGuards(JwtAuthGuard, AdminFincaPorParcelaGuard)
  @ApiAuth()
  @ApiOperation({ summary: 'Consultar monitoreo de sensores de una parcela' })
  @ApiOkResponse({ description: 'Estado persistido de los sensores' })
  @ApiErrorResponses({ notFound: true })
  monitoreo_sensores(@Param('id_parcela', ParseIntPipe) id_parcela: number) {
    return this.lectura_service.obtener_monitoreo(id_parcela);
  }
}
