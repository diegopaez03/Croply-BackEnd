import {
  Body,
  Controller,
  Get,
  Param,
  ParseIntPipe,
  Post,
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
import { SWAGGER_TAGS } from '../../common/swagger';
import { AdminFincaPorParcelaGuard } from '../auth/guards/admin-finca-por-parcela.guard';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import {
  CrearPlanAccionDto,
  PlanPreviewQueryDto,
} from './dto/planes-accion.dto';
import { PlanesAccionService } from './planes-accion.service';

@ApiTags(SWAGGER_TAGS.PARCELAS)
@Controller()
export class PlanesAccionController {
  constructor(private readonly planes_service: PlanesAccionService) {}

  @Get('cultivos-base/:id_cultivo_base/plan-preview')
  @UseGuards(JwtAuthGuard, AdminFincaPorParcelaGuard)
  @ApiAuth()
  @ApiOperation({ summary: 'Previsualizar plan de acción' })
  @ApiOkResponse({ description: 'Previsualización del plan' })
  @ApiErrorResponses({ notFound: true, forbidden: true })
  preview(
    @Param('id_cultivo_base', ParseIntPipe) id_cultivo_base: number,
    @Query() query: PlanPreviewQueryDto,
  ) {
    return this.planes_service.plan_preview(id_cultivo_base, query.id_parcela);
  }

  @Post('parcelas/:id_parcela/planes-accion')
  @UseGuards(JwtAuthGuard, AdminFincaPorParcelaGuard)
  @ApiAuth()
  @ApiOperation({ summary: 'Asignar cultivo y crear plan de acción' })
  @ApiCreatedResponse({ description: 'Plan de acción creado' })
  @ApiErrorResponses({ badRequest: true, forbidden: true, notFound: true })
  crear(
    @Param('id_parcela', ParseIntPipe) id_parcela: number,
    @Body() dto: CrearPlanAccionDto,
  ) {
    return this.planes_service.crear(id_parcela, dto);
  }

  @Get('parcelas/:id_parcela/historial-cultivos')
  @UseGuards(JwtAuthGuard, AdminFincaPorParcelaGuard)
  @ApiAuth()
  @ApiOperation({ summary: 'Consultar historial de cultivos de una parcela' })
  @ApiOkResponse({ description: 'Historial de cultivos' })
  @ApiErrorResponses({ forbidden: true, notFound: true })
  historial(@Param('id_parcela', ParseIntPipe) id_parcela: number) {
    return this.planes_service.historial_cultivos(id_parcela);
  }
}
