import {
  Controller,
  Get,
  HttpStatus,
  Param,
  ParseIntPipe,
  Res,
  UseGuards,
} from '@nestjs/common';
import { ApiNoContentResponse, ApiOkResponse, ApiOperation, ApiTags } from '@nestjs/swagger';
import { Response } from 'express';
import { ApiAuth, ApiErrorResponses } from '../../common/decorators';
import { SWAGGER_TAGS } from '../../common/swagger';
import { AdminFincaPorParcelaGuard } from '../auth/guards/admin-finca-por-parcela.guard';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RecomendacionIaResponseDto } from './dto/recomendacion-ia-response.dto';
import { RecomendacionesIaService } from './recomendaciones-ia.service';

@ApiTags(SWAGGER_TAGS.PARCELAS)
@Controller('parcelas')
export class RecomendacionesIaController {
  constructor(private readonly recomendaciones_service: RecomendacionesIaService) {}

  @Get(':id_parcela/recomendacion-ia')
  @UseGuards(JwtAuthGuard, AdminFincaPorParcelaGuard)
  @ApiAuth()
  @ApiOperation({
    summary: 'Obtener la recomendación agronómica vigente de una parcela',
  })
  @ApiOkResponse({ type: RecomendacionIaResponseDto })
  @ApiNoContentResponse({ description: 'No hay recomendaciones activas' })
  @ApiErrorResponses({ forbidden: true, notFound: true, serviceUnavailable: true })
  async obtener(
    @Param('id_parcela', ParseIntPipe) id_parcela: number,
    @Res() res: Response,
  ) {
    const resultado =
      await this.recomendaciones_service.obtener_recomendacion(id_parcela);
    if (resultado === null) {
      res.status(HttpStatus.NO_CONTENT).send();
      return;
    }
    res.status(HttpStatus.OK).json(resultado);
  }
}
