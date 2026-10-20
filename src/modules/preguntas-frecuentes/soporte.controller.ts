import { Controller, Get, UseGuards } from '@nestjs/common';
import { ApiOkResponse, ApiOperation, ApiTags } from '@nestjs/swagger';
import { ApiAuth, ApiErrorResponses } from '../../common/decorators';
import { SWAGGER_TAGS } from '../../common/swagger';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { SoporteConfiguracionResponseDto } from './dto/soporte-configuracion-response.dto';
import { SoporteService } from './soporte.service';

@ApiTags(SWAGGER_TAGS.SOPORTE)
@Controller('soporte')
export class SoporteController {
  constructor(private readonly soporte_service: SoporteService) {}

  @Get('configuracion')
  @UseGuards(JwtAuthGuard)
  @ApiAuth()
  @ApiOperation({
    summary: 'Obtener configuración de soporte',
    description:
      'Manual de usuario y correo de soporte para cualquier usuario autenticado. Un valor no configurado o inválido viaja como null.',
  })
  @ApiOkResponse({
    description: 'Configuración de soporte',
    type: SoporteConfiguracionResponseDto,
  })
  @ApiErrorResponses({ badRequest: false })
  obtener_configuracion() {
    return this.soporte_service.obtener_configuracion();
  }
}
