import { Controller, Get, Param, ParseIntPipe, UseGuards } from '@nestjs/common';
import { ApiOkResponse, ApiOperation, ApiTags } from '@nestjs/swagger';
import { ApiAuth, ApiErrorResponses } from '../../common/decorators';
import { SWAGGER_TAGS } from '../../common/swagger';
import { AdminFincaPorParcelaGuard } from '../auth/guards/admin-finca-por-parcela.guard';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { ParcelasService } from './parcelas.service';

@ApiTags(SWAGGER_TAGS.PARCELAS)
@Controller('parcelas')
export class ParcelaDetalleController {
  constructor(private readonly parcelas_service: ParcelasService) {}

  @Get(':id_parcela')
  @UseGuards(JwtAuthGuard, AdminFincaPorParcelaGuard)
  @ApiAuth()
  @ApiOperation({ summary: 'Consultar detalle de parcela' })
  @ApiOkResponse({ description: 'Detalle de parcela' })
  @ApiErrorResponses({ forbidden: true, notFound: true })
  detalle(@Param('id_parcela', ParseIntPipe) id_parcela: number) {
    return this.parcelas_service.detalle(id_parcela);
  }
}