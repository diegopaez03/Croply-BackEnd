import {
  Controller,
  Get,
  Param,
  ParseIntPipe,
  Query,
  UseGuards,
} from '@nestjs/common';
import { ApiOkResponse, ApiOperation, ApiTags } from '@nestjs/swagger';
import { ApiAuth, ApiErrorResponses } from '../../common/decorators';
import { SWAGGER_TAGS } from '../../common/swagger';
import { AdminFincaGuard } from '../auth/guards/admin-finca.guard';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { AlertasClimaticasCronService } from './alertas-climaticas-cron.service';
import { ListadoAlertasClimaticasResponseDto } from './dto/alerta-climatica-response.dto';
import { AlertasClimaticasQueryDto } from './dto/alertas-climaticas-query.dto';
import { EstadoAlertaClimatica } from './enums/estado-alerta-climatica.enum';

@ApiTags(SWAGGER_TAGS.FINCAS)
@Controller('fincas')
export class AlertasClimaticasController {
  constructor(private readonly alertas_service: AlertasClimaticasCronService) {}

  @Get(':id_finca/alertas-climaticas')
  @UseGuards(JwtAuthGuard, AdminFincaGuard)
  @ApiAuth()
  @ApiOperation({ summary: 'Consultar alertas climáticas de una finca' })
  @ApiOkResponse({ type: ListadoAlertasClimaticasResponseDto })
  @ApiErrorResponses({ forbidden: true, notFound: true })
  listar(
    @Param('id_finca', ParseIntPipe) id_finca: number,
    @Query() query: AlertasClimaticasQueryDto,
  ) {
    return this.alertas_service.listar(
      id_finca,
      query.estado ?? EstadoAlertaClimatica.VIGENTE,
    );
  }
}
