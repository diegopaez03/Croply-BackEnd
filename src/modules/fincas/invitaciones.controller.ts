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
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { PermisoGuard } from '../auth/guards/permiso.guard';
import { RequirePermiso } from '../auth/decorators/require-permiso.decorator';
import { PERMISO_FINCA } from '../../common/enums';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { Usuario } from '../usuarios/entities/usuario.entity';
import { FincasService } from './fincas.service';

@ApiTags(SWAGGER_TAGS.FINCAS)
@Controller('invitaciones')
export class InvitacionesController {
  constructor(private readonly fincas_service: FincasService) {}

  @Post(':id_invitacion_finca/reenviar')
  @UseGuards(JwtAuthGuard, PermisoGuard)
  @RequirePermiso(PERMISO_FINCA.GESTION_TRABAJADORES)
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
