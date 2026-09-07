import {
  Body,
  Controller,
  Delete,
  Param,
  ParseIntPipe,
  Post,
  Put,
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
import { AdminCroplyGuard } from '../auth/guards/admin-croply.guard';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { ActualizarParcelaDto, CrearParcelaDto } from './dto/parcelas.dto';
import { ParcelasService } from './parcelas.service';

@ApiTags(SWAGGER_TAGS.PARCELAS)
@Controller('fincas')
export class ParcelasController {
  constructor(private readonly parcelas_service: ParcelasService) {}

  @Post(':id_finca/parcelas')
  @UseGuards(JwtAuthGuard, AdminCroplyGuard)
  @ApiAuth()
  @ApiOperation({ summary: 'Crear parcela con infraestructura IoT' })
  @ApiCreatedResponse({ description: 'Parcela creada' })
  @ApiErrorResponses({ badRequest: true, conflict: true, notFound: true })
  crear(
    @Param('id_finca', ParseIntPipe) id_finca: number,
    @Body() dto: CrearParcelaDto,
  ) {
    return this.parcelas_service.crear(id_finca, dto);
  }

  @Put(':id_finca/parcelas/:id_parcela')
  @UseGuards(JwtAuthGuard, AdminCroplyGuard)
  @ApiAuth()
  @ApiOperation({ summary: 'Editar parcela e infraestructura IoT' })
  @ApiOkResponse({ description: 'Parcela actualizada' })
  @ApiErrorResponses({ badRequest: true, conflict: true, notFound: true })
  actualizar(
    @Param('id_finca', ParseIntPipe) id_finca: number,
    @Param('id_parcela', ParseIntPipe) id_parcela: number,
    @Body() dto: ActualizarParcelaDto,
  ) {
    return this.parcelas_service.actualizar(id_finca, id_parcela, dto);
  }

  @Delete(':id_finca/parcelas/:id_parcela')
  @UseGuards(JwtAuthGuard, AdminCroplyGuard)
  @ApiAuth()
  @ApiOperation({ summary: 'Dar de baja parcela' })
  @ApiOkResponse({ description: 'Parcela dada de baja' })
  @ApiErrorResponses({ notFound: true })
  dar_baja(
    @Param('id_finca', ParseIntPipe) id_finca: number,
    @Param('id_parcela', ParseIntPipe) id_parcela: number,
  ) {
    return this.parcelas_service.dar_baja(id_finca, id_parcela);
  }
}
