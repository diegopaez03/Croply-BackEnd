import {
  Controller,
  Get,
  Param,
  ParseIntPipe,
  Post,
  UseGuards,
} from '@nestjs/common';
import {
  ApiCreatedResponse,
  ApiOkResponse,
  ApiOperation,
  ApiTags,
} from '@nestjs/swagger';
import { ApiAuth, ApiErrorResponses } from '../../common/decorators';
import { SWAGGER_TAGS } from '../../common/swagger';
import { AdminFincaPorParcelaGuard } from '../auth/guards/admin-finca-por-parcela.guard';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { ParcelasService } from './parcelas.service';

@ApiTags(SWAGGER_TAGS.PARCELAS)
@Controller('parcelas')
export class CodigoQrController {
  constructor(private readonly parcelas_service: ParcelasService) {}

  @Post(':id_parcela/codigo-qr')
  @UseGuards(JwtAuthGuard, AdminFincaPorParcelaGuard)
  @ApiAuth()
  @ApiOperation({ summary: 'Generar código QR de parcela' })
  @ApiCreatedResponse({ description: 'Código QR generado' })
  @ApiErrorResponses({ forbidden: true, notFound: true })
  generar(@Param('id_parcela', ParseIntPipe) id_parcela: number) {
    return this.parcelas_service.generar_codigo_qr(id_parcela);
  }

  @Get(':id_parcela/codigo-qr')
  @UseGuards(JwtAuthGuard, AdminFincaPorParcelaGuard)
  @ApiAuth()
  @ApiOperation({ summary: 'Consultar código QR de parcela' })
  @ApiOkResponse({ description: 'Código QR de parcela' })
  @ApiErrorResponses({ forbidden: true, notFound: true })
  consultar(@Param('id_parcela', ParseIntPipe) id_parcela: number) {
    return this.parcelas_service.consultar_codigo_qr(id_parcela);
  }
}
