import { Controller, Get, UseGuards } from '@nestjs/common';
import { ApiOkResponse, ApiOperation, ApiTags } from '@nestjs/swagger';
import { ApiAuth, ApiErrorResponses } from '../../common/decorators';
import { SWAGGER_TAGS } from '../../common/swagger';
import { AdminCroplyGuard } from '../auth/guards/admin-croply.guard';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { TableroGlobalResponseDto } from './dto/tablero-global-response.dto';
import { TableroGlobalService } from './tablero-global.service';

@ApiTags(SWAGGER_TAGS.REPORTS)
@Controller('admin')
export class TableroGlobalController {
  constructor(private readonly tablero_global_service: TableroGlobalService) {}

  @Get('tablero-global')
  @UseGuards(JwtAuthGuard, AdminCroplyGuard)
  @ApiAuth()
  @ApiOperation({
    summary: 'Tablero global del Admin Croply',
    description:
      'Métricas agregadas de toda la plataforma: clientes, sensores, hectáreas y altas de fincas de los últimos 6 meses (incluido el actual).',
  })
  @ApiOkResponse({ type: TableroGlobalResponseDto })
  @ApiErrorResponses({ forbidden: true, badRequest: false })
  obtener() {
    return this.tablero_global_service.obtener_tablero();
  }
}
