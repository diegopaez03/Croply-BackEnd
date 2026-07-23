import { Body, Controller, Post, UseGuards } from '@nestjs/common';
import {
  ApiCreatedResponse,
  ApiOperation,
  ApiTags,
} from '@nestjs/swagger';
import { SWAGGER_TAGS } from '../../common/swagger';
import { ApiErrorResponses } from '../../common/decorators';
import { SolicitudesDigitalizacionService } from './solicitudes-digitalizacion.service';
import { CrearSolicitudDigitalizacionDto } from './dto/crear-solicitud-digitalizacion.dto';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { Usuario } from '../usuarios/entities/usuario.entity';
import { OptionalJwtAuthGuard } from '../auth/guards/optional-jwt-auth.guard';

@ApiTags(SWAGGER_TAGS.SOLICITUDES_DIGITALIZACION)
@Controller('solicitudes-digitalizacion')
export class SolicitudesDigitalizacionController {
  constructor(
    private readonly solicitudes_service: SolicitudesDigitalizacionService,
  ) {}

  @Post()
  @UseGuards(OptionalJwtAuthGuard)
  @ApiOperation({
    summary: 'Solicitar digitalización de finca',
    description:
      'Endpoint público (landing). Si hay JWT, asocia la solicitud al usuario autenticado.',
  })
  @ApiCreatedResponse({ description: 'Solicitud creada' })
  @ApiErrorResponses({ unauthorized: false, badRequest: true })
  crear(
    @Body() dto: CrearSolicitudDigitalizacionDto,
    @CurrentUser() usuario?: Usuario,
  ) {
    return this.solicitudes_service.crear(dto, usuario ?? null);
  }
}
