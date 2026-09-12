import { Controller, Get, UseGuards } from '@nestjs/common';
import { ApiOkResponse, ApiOperation, ApiTags } from '@nestjs/swagger';
import { ApiAuth, ApiErrorResponses } from '../../common/decorators';
import { SWAGGER_TAGS } from '../../common/swagger';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { Usuario } from '../usuarios/entities/usuario.entity';
import { FincasService } from './fincas.service';

@ApiTags(SWAGGER_TAGS.FINCAS)
@Controller('mi-finca')
export class MiFincaController {
  constructor(private readonly fincas_service: FincasService) {}

  @Get('fincas')
  @UseGuards(JwtAuthGuard)
  @ApiAuth()
  @ApiOperation({ summary: 'Listar fincas activas del usuario autenticado' })
  @ApiOkResponse({ description: 'Fincas activas del usuario' })
  @ApiErrorResponses()
  listar_fincas(@CurrentUser() usuario: Usuario) {
    return this.fincas_service.listar_mi_finca_fincas(usuario);
  }
}