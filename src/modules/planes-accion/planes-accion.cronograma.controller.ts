import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  HttpStatus,
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
import { PERMISO_FINCA } from '../../common/enums';
import { ApiAuth, ApiErrorResponses } from '../../common/decorators';
import { SWAGGER_TAGS } from '../../common/swagger';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { PermisoGuard } from '../auth/guards/permiso.guard';
import { RequirePermiso } from '../auth/decorators/require-permiso.decorator';
import {
  CambiarEstadoPlanDto,
  CambiarEstadoTareaDto,
  CrearTareaPlanDto,
} from './dto/tareas-plan.dto';
import { AlcanceFincaPorPlanGuard } from './guards/alcance-finca-por-plan.guard';
import { PlanesAccionService } from './planes-accion.service';

@ApiTags(SWAGGER_TAGS.PARCELAS)
@Controller('planes-accion')
@UseGuards(JwtAuthGuard, AlcanceFincaPorPlanGuard, PermisoGuard)
@RequirePermiso(PERMISO_FINCA.TAREAS_CAMPO)
@ApiAuth()
export class PlanesAccionCronogramaController {
  constructor(private readonly planes_service: PlanesAccionService) {}

  @Get(':id_plan_accion')
  @ApiOperation({ summary: 'Ver cronograma del plan de acción' })
  @ApiOkResponse({ description: 'Cronograma del plan de acción' })
  @ApiErrorResponses({ forbidden: true, notFound: true })
  detalle(@Param('id_plan_accion', ParseIntPipe) id_plan_accion: number) {
    return this.planes_service.detalle(id_plan_accion);
  }

  @Post(':id_plan_accion/hitos/:id_hito_real/tareas')
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({ summary: 'Agregar una tarea a un hito existente' })
  @ApiCreatedResponse({ description: 'Tarea agregada' })
  @ApiErrorResponses({
    badRequest: true,
    forbidden: true,
    notFound: true,
    conflict: true,
  })
  crear_tarea(
    @Param('id_plan_accion', ParseIntPipe) id_plan_accion: number,
    @Param('id_hito_real', ParseIntPipe) id_hito_real: number,
    @Body() dto: CrearTareaPlanDto,
  ) {
    return this.planes_service.crear_tarea(id_plan_accion, id_hito_real, dto);
  }

  @Put(':id_plan_accion/tareas/:id_tarea')
  @ApiOperation({ summary: 'Editar datos de una tarea (no el estado)' })
  @ApiOkResponse({ description: 'Tarea actualizada' })
  @ApiErrorResponses({
    badRequest: true,
    forbidden: true,
    notFound: true,
    conflict: true,
  })
  editar_tarea(
    @Param('id_plan_accion', ParseIntPipe) id_plan_accion: number,
    @Param('id_tarea', ParseIntPipe) id_tarea: number,
    @Body() dto: CrearTareaPlanDto,
  ) {
    return this.planes_service.editar_tarea(id_plan_accion, id_tarea, dto);
  }

  @Put(':id_plan_accion/tareas/:id_tarea/estado')
  @ApiOperation({ summary: 'Cambiar el estado de una tarea' })
  @ApiOkResponse({ description: 'Estado de la tarea actualizado' })
  @ApiErrorResponses({
    badRequest: true,
    forbidden: true,
    notFound: true,
    conflict: true,
  })
  cambiar_estado_tarea(
    @Param('id_plan_accion', ParseIntPipe) id_plan_accion: number,
    @Param('id_tarea', ParseIntPipe) id_tarea: number,
    @Body() dto: CambiarEstadoTareaDto,
  ) {
    return this.planes_service.cambiar_estado_tarea(
      id_plan_accion,
      id_tarea,
      dto.estado,
    );
  }

  @Delete(':id_plan_accion/tareas/:id_tarea')
  @ApiOperation({ summary: 'Eliminar una tarea del plan' })
  @ApiOkResponse({ description: 'Tarea eliminada' })
  @ApiErrorResponses({
    forbidden: true,
    notFound: true,
    conflict: true,
  })
  eliminar_tarea(
    @Param('id_plan_accion', ParseIntPipe) id_plan_accion: number,
    @Param('id_tarea', ParseIntPipe) id_tarea: number,
  ) {
    return this.planes_service.eliminar_tarea(id_plan_accion, id_tarea);
  }

  @Put(':id_plan_accion/estado')
  @ApiOperation({ summary: 'Cambiar el estado del plan de acción' })
  @ApiOkResponse({ description: 'Estado del plan actualizado' })
  @ApiErrorResponses({
    badRequest: true,
    forbidden: true,
    notFound: true,
  })
  cambiar_estado_plan(
    @Param('id_plan_accion', ParseIntPipe) id_plan_accion: number,
    @Body() dto: CambiarEstadoPlanDto,
  ) {
    return this.planes_service.cambiar_estado_plan(id_plan_accion, dto.estado);
  }
}
