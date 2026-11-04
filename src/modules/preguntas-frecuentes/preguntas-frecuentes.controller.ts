import {
  Body,
  Controller,
  Delete,
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
import { ApiAuth, ApiErrorResponses } from '../../common/decorators';
import { PageSizePaginationQueryDto } from '../../common/dto';
import { PERMISO_SISTEMA } from '../../common/enums';
import { SWAGGER_TAGS } from '../../common/swagger';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { RequirePermiso } from '../auth/decorators/require-permiso.decorator';
import { AdminCroplyGuard } from '../auth/guards/admin-croply.guard';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { PermisoGuard } from '../auth/guards/permiso.guard';
import { Usuario } from '../usuarios/entities/usuario.entity';
import { ActualizarPreguntaFrecuenteDto } from './dto/actualizar-pregunta-frecuente.dto';
import { CrearPreguntaFrecuenteDto } from './dto/crear-pregunta-frecuente.dto';
import {
  ActualizarPreguntaFrecuenteResponseDto,
  CrearPreguntaFrecuenteResponseDto,
  EliminarPreguntaFrecuenteResponseDto,
  ListarPreguntasFrecuentesGestionResponseDto,
  ListarPreguntasFrecuentesResponseDto,
} from './dto/pregunta-frecuente-response.dto';
import { PreguntasFrecuentesService } from './preguntas-frecuentes.service';

@ApiTags(SWAGGER_TAGS.SOPORTE)
@Controller('preguntas-frecuentes')
export class PreguntasFrecuentesController {
  constructor(
    private readonly preguntas_frecuentes_service: PreguntasFrecuentesService,
  ) {}

  @Get('gestion')
  @UseGuards(JwtAuthGuard, AdminCroplyGuard, PermisoGuard)
  @RequirePermiso(PERMISO_SISTEMA.SOPORTE)
  @ApiAuth()
  @ApiOperation({
    summary: 'Listar preguntas frecuentes (editor)',
    description:
      'Listado paginado para el editor de Admin Croply. Orden: la última creada primero.',
  })
  @ApiOkResponse({
    description: 'Listado paginado de preguntas frecuentes activas',
    type: ListarPreguntasFrecuentesGestionResponseDto,
  })
  @ApiErrorResponses({ forbidden: true })
  listar_gestion(@Query() query: PageSizePaginationQueryDto) {
    return this.preguntas_frecuentes_service.listar_gestion(query);
  }

  @Get()
  @UseGuards(JwtAuthGuard)
  @ApiAuth()
  @ApiOperation({
    summary: 'Consultar preguntas frecuentes',
    description:
      'Lista completa, sin paginar, de preguntas activas para cualquier usuario autenticado. Orden alfabético por pregunta.',
  })
  @ApiOkResponse({
    description: 'Preguntas frecuentes activas',
    type: ListarPreguntasFrecuentesResponseDto,
  })
  @ApiErrorResponses({ badRequest: false })
  listar() {
    return this.preguntas_frecuentes_service.listar();
  }

  @Post()
  @UseGuards(JwtAuthGuard, AdminCroplyGuard, PermisoGuard)
  @RequirePermiso(PERMISO_SISTEMA.SOPORTE)
  @ApiAuth()
  @ApiOperation({ summary: 'Crear pregunta frecuente' })
  @ApiCreatedResponse({
    description: 'Pregunta frecuente creada',
    type: CrearPreguntaFrecuenteResponseDto,
  })
  @ApiErrorResponses({ forbidden: true, conflict: true })
  crear(
    @Body() dto: CrearPreguntaFrecuenteDto,
    @CurrentUser() usuario: Usuario,
  ) {
    return this.preguntas_frecuentes_service.crear(dto, usuario);
  }

  @Put(':id_pregunta_frecuente')
  @UseGuards(JwtAuthGuard, AdminCroplyGuard, PermisoGuard)
  @RequirePermiso(PERMISO_SISTEMA.SOPORTE)
  @ApiAuth()
  @ApiOperation({ summary: 'Editar pregunta frecuente' })
  @ApiOkResponse({
    description: 'Pregunta frecuente actualizada',
    type: ActualizarPreguntaFrecuenteResponseDto,
  })
  @ApiErrorResponses({ forbidden: true, notFound: true, conflict: true })
  actualizar(
    @Param('id_pregunta_frecuente', ParseIntPipe) id_pregunta_frecuente: number,
    @Body() dto: ActualizarPreguntaFrecuenteDto,
    @CurrentUser() usuario: Usuario,
  ) {
    return this.preguntas_frecuentes_service.actualizar(
      id_pregunta_frecuente,
      dto,
      usuario,
    );
  }

  @Delete(':id_pregunta_frecuente')
  @UseGuards(JwtAuthGuard, AdminCroplyGuard, PermisoGuard)
  @RequirePermiso(PERMISO_SISTEMA.SOPORTE)
  @ApiAuth()
  @ApiOperation({
    summary: 'Eliminar pregunta frecuente',
    description: 'Baja lógica: setea fecha_baja_pf.',
  })
  @ApiOkResponse({
    description: 'Pregunta frecuente eliminada',
    type: EliminarPreguntaFrecuenteResponseDto,
  })
  @ApiErrorResponses({ forbidden: true, notFound: true })
  dar_baja(
    @Param('id_pregunta_frecuente', ParseIntPipe) id_pregunta_frecuente: number,
    @CurrentUser() usuario: Usuario,
  ) {
    return this.preguntas_frecuentes_service.dar_baja(
      id_pregunta_frecuente,
      usuario,
    );
  }
}
