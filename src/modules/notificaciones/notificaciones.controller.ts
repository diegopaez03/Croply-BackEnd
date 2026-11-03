import {
  Controller,
  Get,
  Param,
  ParseIntPipe,
  Put,
  UseGuards,
} from '@nestjs/common';
import { ApiOkResponse, ApiOperation, ApiTags } from '@nestjs/swagger';
import { ApiAuth, ApiErrorResponses } from '../../common/decorators';
import { SWAGGER_TAGS } from '../../common/swagger';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { Usuario } from '../usuarios/entities/usuario.entity';
import {
  ListadoNotificacionesResponseDto,
  NotificacionResponseDto,
} from './dto/notificacion-response.dto';
import { NotificacionesService } from './notificaciones.service';

@ApiTags(SWAGGER_TAGS.NOTIFICACIONES)
@Controller('notificaciones')
@UseGuards(JwtAuthGuard)
@ApiAuth()
export class NotificacionesController {
  constructor(private readonly notificaciones_service: NotificacionesService) {}

  @Get()
  @ApiOperation({ summary: 'Listar notificaciones del usuario autenticado' })
  @ApiOkResponse({ type: ListadoNotificacionesResponseDto })
  @ApiErrorResponses()
  listar(@CurrentUser() usuario: Usuario) {
    return this.notificaciones_service.listar(usuario);
  }

  @Put('leidas')
  @ApiOperation({ summary: 'Marcar todas las notificaciones como leídas' })
  @ApiOkResponse({ schema: { example: { no_leidas: 0 } } })
  @ApiErrorResponses()
  marcar_todas(@CurrentUser() usuario: Usuario) {
    return this.notificaciones_service.marcar_todas_leidas(usuario);
  }

  @Put(':id_notificacion/leida')
  @ApiOperation({ summary: 'Marcar una notificación como leída' })
  @ApiOkResponse({ type: NotificacionResponseDto })
  @ApiErrorResponses({ notFound: true })
  marcar_una(
    @CurrentUser() usuario: Usuario,
    @Param('id_notificacion', ParseIntPipe) id_notificacion: number,
  ) {
    return this.notificaciones_service.marcar_leida(usuario, id_notificacion);
  }
}
