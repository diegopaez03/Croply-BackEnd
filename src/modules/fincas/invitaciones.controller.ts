import {
  Controller,
  Param,
  ParseIntPipe,
  Post,
  UseGuards,
} from '@nestjs/common';
import { ApiOkResponse, ApiOperation, ApiTags } from '@nestjs/swagger';
import { ApiAuth, ApiErrorResponses } from '../../common/decorators';
import { SWAGGER_TAGS } from '../../common/swagger';
import { CurrentUser, JwtAuthGuard } from '../auth';
import { Usuario } from '../usuarios/entities/usuario.entity';
import { FincasService } from './fincas.service';

@ApiTags(SWAGGER_TAGS.FINCAS)
@Controller('invitaciones')
export class InvitacionesController {
  constructor(private readonly fincas_service: FincasService) {}

  @Post(':id_invitacion_finca/reenviar')
  @UseGuards(JwtAuthGuard)
  @ApiAuth()
  @ApiOperation({ summary: 'Reenviar invitación a empleado' })
  @ApiOkResponse({ description: 'Invitación reenviada' })
  @ApiErrorResponses({ notFound: true })
  reenviar(
    @Param('id_invitacion_finca', ParseIntPipe) id_invitacion_finca: number,
    @CurrentUser() usuario: Usuario,
  ) {
    return this.fincas_service.reenviar_invitacion(
      id_invitacion_finca,
      usuario,
    );
  }
}
