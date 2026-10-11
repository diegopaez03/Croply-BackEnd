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
  Query,
  Res,
  StreamableFile,
  UseGuards,
} from '@nestjs/common';
import {
  ApiCreatedResponse,
  ApiOkResponse,
  ApiOperation,
  ApiProduces,
  ApiTags,
} from '@nestjs/swagger';
import { Response } from 'express';
import { ApiAuth, ApiErrorResponses } from '../../common/decorators';
import { PERMISO_FINCA } from '../../common/enums';
import { SWAGGER_TAGS } from '../../common/swagger';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { RequirePermiso } from '../auth/decorators/require-permiso.decorator';
import { AdminFincaGuard } from '../auth/guards/admin-finca.guard';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { PermisoGuard } from '../auth/guards/permiso.guard';
import { Usuario } from '../usuarios/entities/usuario.entity';
import {
  ActualizarGastoDto,
  ActualizarGastoResponseDto,
  CrearGastoDto,
  CrearGastoResponseDto,
  EvolucionMensualQueryDto,
  ExportarGastosDto,
  ListarGastosQueryDto,
  ListarGastosResponseDto,
  MesEvolucionDto,
} from './dto/gastos.dto';
import { GastosService } from './gastos.service';

@ApiTags(SWAGGER_TAGS.GASTOS)
@Controller('fincas/:id_finca/gastos')
@UseGuards(JwtAuthGuard, AdminFincaGuard, PermisoGuard)
@RequirePermiso(PERMISO_FINCA.COSTOS)
@ApiAuth()
export class GastosController {
  constructor(private readonly gastos_service: GastosService) {}

  @Get('evolucion-mensual')
  @ApiOperation({ summary: 'Evolución mensual de gastos de la finca' })
  @ApiOkResponse({ type: [MesEvolucionDto] })
  @ApiErrorResponses({ forbidden: true, notFound: true })
  evolucion_mensual(
    @Param('id_finca', ParseIntPipe) id_finca: number,
    @Query() query: EvolucionMensualQueryDto,
  ) {
    return this.gastos_service.evolucion_mensual(id_finca, query);
  }

  @Post('exportar')
  @HttpCode(HttpStatus.OK)
  @RequirePermiso(PERMISO_FINCA.REPORTES)
  @ApiOperation({ summary: 'Exportar historial de costos a PDF' })
  @ApiProduces('application/pdf')
  @ApiOkResponse({ description: 'PDF del historial de costos' })
  @ApiErrorResponses({ forbidden: true, notFound: true })
  async exportar(
    @Param('id_finca', ParseIntPipe) id_finca: number,
    @Body() dto: ExportarGastosDto,
    @Res({ passthrough: true }) res: Response,
  ): Promise<StreamableFile> {
    const archivo = await this.gastos_service.exportar(id_finca, dto);
    res.set({
      'Content-Type': 'application/pdf',
      'Content-Disposition': `attachment; filename="${archivo.filename}"`,
    });
    return new StreamableFile(archivo.buffer);
  }

  @Get()
  @ApiOperation({ summary: 'Listar gastos de producción de la finca' })
  @ApiOkResponse({ type: ListarGastosResponseDto })
  @ApiErrorResponses({ forbidden: true, notFound: true })
  listar(
    @Param('id_finca', ParseIntPipe) id_finca: number,
    @Query() query: ListarGastosQueryDto,
  ) {
    return this.gastos_service.listar(id_finca, query);
  }

  @Post()
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({ summary: 'Registrar un gasto de producción' })
  @ApiCreatedResponse({ type: CrearGastoResponseDto })
  @ApiErrorResponses({ forbidden: true, notFound: true })
  crear(
    @Param('id_finca', ParseIntPipe) id_finca: number,
    @Body() dto: CrearGastoDto,
    @CurrentUser() actor: Usuario,
  ) {
    return this.gastos_service.crear(id_finca, dto, actor);
  }

  @Put(':id_gasto_produccion')
  @ApiOperation({ summary: 'Editar un gasto de producción' })
  @ApiOkResponse({ type: ActualizarGastoResponseDto })
  @ApiErrorResponses({ forbidden: true, notFound: true })
  actualizar(
    @Param('id_finca', ParseIntPipe) id_finca: number,
    @Param('id_gasto_produccion', ParseIntPipe) id_gasto_produccion: number,
    @Body() dto: ActualizarGastoDto,
    @CurrentUser() actor: Usuario,
  ) {
    return this.gastos_service.actualizar(
      id_finca,
      id_gasto_produccion,
      dto,
      actor,
    );
  }

  @Delete(':id_gasto_produccion')
  @ApiOperation({ summary: 'Dar de baja lógica un gasto de producción' })
  @ApiOkResponse({
    schema: {
      example: { message: 'Gasto eliminado correctamente' },
    },
  })
  @ApiErrorResponses({ forbidden: true, notFound: true })
  dar_baja(
    @Param('id_finca', ParseIntPipe) id_finca: number,
    @Param('id_gasto_produccion', ParseIntPipe) id_gasto_produccion: number,
    @CurrentUser() actor: Usuario,
  ) {
    return this.gastos_service.dar_baja(id_finca, id_gasto_produccion, actor);
  }
}
