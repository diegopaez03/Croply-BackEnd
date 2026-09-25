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
import { ActualizarTipoTareaDto } from './dto/actualizar-tipo-tarea.dto';
import { CrearTipoTareaDto } from './dto/crear-tipo-tarea.dto';
import { TiposTareaService } from './tipos-tarea.service';

@ApiTags(SWAGGER_TAGS.TIPOS_TAREA)
@Controller('tipos-tarea')
export class TiposTareaController {
  constructor(private readonly tipos_tarea_service: TiposTareaService) {}

  @Get()
  @UseGuards(JwtAuthGuard)
  @ApiAuth()
  @ApiOperation({ summary: 'Listar tipos de tarea' })
  @ApiOkResponse({ description: 'Listado de tipos de tarea activos' })
  @ApiErrorResponses({ badRequest: false })
  listar() {
    return this.tipos_tarea_service.listar();
  }

  @Post()
  @UseGuards(JwtAuthGuard, AdminCroplyGuard, PermisoGuard)
  @RequirePermiso(PERMISO_SISTEMA.CATALOGOS_BASE)
  @ApiAuth()
  @ApiOperation({ summary: 'Crear tipo de tarea' })
  @ApiCreatedResponse({ description: 'Tipo de tarea creado' })
  @ApiErrorResponses({ forbidden: true, conflict: true })
  crear(@Body() dto: CrearTipoTareaDto, @CurrentUser() usuario: Usuario) {
    return this.tipos_tarea_service.crear(dto, usuario);
  }

  @Put(':id_tipo_tarea')
  @UseGuards(JwtAuthGuard, AdminCroplyGuard, PermisoGuard)
  @RequirePermiso(PERMISO_SISTEMA.CATALOGOS_BASE)
  @ApiAuth()
  @ApiOperation({ summary: 'Editar tipo de tarea' })
  @ApiOkResponse({ description: 'Tipo de tarea actualizado' })
  @ApiErrorResponses({ forbidden: true, notFound: true, conflict: true })
  actualizar(
    @Param('id_tipo_tarea', ParseIntPipe) id_tipo_tarea: number,
    @Body() dto: ActualizarTipoTareaDto,
    @CurrentUser() usuario: Usuario,
  ) {
    return this.tipos_tarea_service.actualizar(id_tipo_tarea, dto, usuario);
  }

  @Delete(':id_tipo_tarea')
  @UseGuards(JwtAuthGuard, AdminCroplyGuard, PermisoGuard)
  @RequirePermiso(PERMISO_SISTEMA.CATALOGOS_BASE)
  @ApiAuth()
  @ApiOperation({ summary: 'Dar de baja tipo de tarea' })
  @ApiOkResponse({ description: 'Tipo de tarea dado de baja' })
  @ApiErrorResponses({ forbidden: true, notFound: true, conflict: true })
  dar_baja(
    @Param('id_tipo_tarea', ParseIntPipe) id_tipo_tarea: number,
    @CurrentUser() usuario: Usuario,
  ) {
    return this.tipos_tarea_service.dar_baja(id_tipo_tarea, usuario);
  }
}
