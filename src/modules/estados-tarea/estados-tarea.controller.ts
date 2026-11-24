import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  ParseIntPipe,
  Post,
  Put,
  UseGuards,
} from '@nestjs/common';
import {
  ApiCreatedResponse,
  ApiOkResponse,
  ApiOperation,
  ApiTags,
} from '@nestjs/swagger';
import { ApiAuth, ApiErrorResponses } from '../../common/decorators';
import { PERMISO_SISTEMA } from '../../common/enums';
import { SWAGGER_TAGS } from '../../common/swagger';
import { RequirePermiso } from '../auth/decorators/require-permiso.decorator';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { AdminCroplyGuard } from '../auth/guards/admin-croply.guard';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { PermisoGuard } from '../auth/guards/permiso.guard';
import { Usuario } from '../usuarios/entities/usuario.entity';
import { ActualizarEstadoTareaDto } from './dto/actualizar-estado-tarea.dto';
import { CrearEstadoTareaDto } from './dto/crear-estado-tarea.dto';
import { EstadosTareaService } from './estados-tarea.service';

@ApiTags(SWAGGER_TAGS.ESTADOS_TAREA)
@Controller('estados-tarea')
export class EstadosTareaController {
  constructor(private readonly estados_tarea_service: EstadosTareaService) {}

  @Get()
  @UseGuards(JwtAuthGuard)
  @ApiAuth()
  @ApiOperation({ summary: 'Listar estados de tarea' })
  @ApiOkResponse({ description: 'Listado de estados de tarea activos' })
  @ApiErrorResponses({ badRequest: false })
  listar() {
    return this.estados_tarea_service.listar();
  }

  @Post()
  @UseGuards(JwtAuthGuard, AdminCroplyGuard, PermisoGuard)
  @RequirePermiso(PERMISO_SISTEMA.CATALOGOS_BASE)
  @ApiAuth()
  @ApiOperation({ summary: 'Crear estado de tarea' })
  @ApiCreatedResponse({ description: 'Estado de tarea creado' })
  @ApiErrorResponses({ forbidden: true, conflict: true })
  crear(@Body() dto: CrearEstadoTareaDto, @CurrentUser() usuario: Usuario) {
    return this.estados_tarea_service.crear(dto, usuario);
  }

  @Put(':id_estado_tarea')
  @UseGuards(JwtAuthGuard, AdminCroplyGuard, PermisoGuard)
  @RequirePermiso(PERMISO_SISTEMA.CATALOGOS_BASE)
  @ApiAuth()
  @ApiOperation({ summary: 'Editar estado de tarea' })
  @ApiOkResponse({ description: 'Estado de tarea actualizado' })
  @ApiErrorResponses({ forbidden: true, notFound: true, conflict: true })
  actualizar(
    @Param('id_estado_tarea', ParseIntPipe) id_estado_tarea: number,
    @Body() dto: ActualizarEstadoTareaDto,
    @CurrentUser() usuario: Usuario,
  ) {
    return this.estados_tarea_service.actualizar(
      id_estado_tarea,
      dto,
      usuario,
    );
  }

  @Delete(':id_estado_tarea')
  @UseGuards(JwtAuthGuard, AdminCroplyGuard, PermisoGuard)
  @RequirePermiso(PERMISO_SISTEMA.CATALOGOS_BASE)
  @ApiAuth()
  @ApiOperation({ summary: 'Dar de baja estado de tarea' })
  @ApiOkResponse({ description: 'Estado de tarea dado de baja' })
  @ApiErrorResponses({ forbidden: true, notFound: true, conflict: true })
  dar_baja(
    @Param('id_estado_tarea', ParseIntPipe) id_estado_tarea: number,
    @CurrentUser() usuario: Usuario,
  ) {
    return this.estados_tarea_service.dar_baja(id_estado_tarea, usuario);
  }
}
