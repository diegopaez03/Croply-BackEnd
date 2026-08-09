import {
  Body,
  Controller,
  Get,
  Param,
  ParseIntPipe,
  Post,
  Put,
  Query,
  UseGuards,
} from '@nestjs/common';
import {
  ApiCreatedResponse,
  ApiOkResponse,
  ApiOperation,
  ApiTags,
} from '@nestjs/swagger';
import { SWAGGER_TAGS } from '../../common/swagger';
import { ApiAuth, ApiErrorResponses } from '../../common/decorators';
import { SolicitudesDigitalizacionService } from './solicitudes-digitalizacion.service';
import { CrearSolicitudDigitalizacionDto } from './dto/crear-solicitud-digitalizacion.dto';
import { ActualizarEstadoSolicitudDto } from './dto/actualizar-estado-solicitud.dto';
import { ListarSolicitudesQueryDto } from './dto/listar-solicitudes-query.dto';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { Usuario } from '../usuarios/entities/usuario.entity';
import { OptionalJwtAuthGuard } from '../auth/guards/optional-jwt-auth.guard';
import { AdminCroplyGuard } from '../auth/guards/admin-croply.guard';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';

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

  @Get()
  @UseGuards(JwtAuthGuard, AdminCroplyGuard)
  @ApiAuth()
  @ApiOperation({
    summary: 'Listar solicitudes de digitalización',
    description:
      'Soporta búsqueda por nombre/correo (`search`) y filtro por `estado`.',
  })
  @ApiOkResponse({ description: 'Listado paginado' })
  @ApiErrorResponses({ badRequest: true })
  listar(@Query() query: ListarSolicitudesQueryDto) {
    return this.solicitudes_service.listar(query);
  }

  @Get(':id_solicitud_df')
  @UseGuards(JwtAuthGuard, AdminCroplyGuard)
  @ApiAuth()
  @ApiOperation({ summary: 'Detalle de solicitud de digitalización' })
  @ApiOkResponse({ description: 'Detalle de la solicitud' })
  @ApiErrorResponses({ notFound: true })
  detalle(@Param('id_solicitud_df', ParseIntPipe) id_solicitud_df: number) {
    return this.solicitudes_service.detalle(id_solicitud_df);
  }

  @Put(':id_solicitud_df/estado')
  @UseGuards(JwtAuthGuard, AdminCroplyGuard)
  @ApiAuth()
  @ApiOperation({ summary: 'Actualizar estado de una solicitud' })
  @ApiOkResponse({ description: 'Estado actualizado' })
  @ApiErrorResponses({ notFound: true, badRequest: true })
  actualizar_estado(
    @Param('id_solicitud_df', ParseIntPipe) id_solicitud_df: number,
    @Body() dto: ActualizarEstadoSolicitudDto,
    @CurrentUser() usuario: Usuario,
  ) {
    return this.solicitudes_service.actualizar_estado(
      id_solicitud_df,
      dto,
      usuario,
    );
  }
}
