import {
  Body,
  Controller,
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
import { RequirePermiso } from '../auth/decorators/require-permiso.decorator';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { AdminFincaGuard } from '../auth/guards/admin-finca.guard';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { PermisoGuard } from '../auth/guards/permiso.guard';
import { Usuario } from '../usuarios/entities/usuario.entity';
import { AgroquimicosService } from './agroquimicos.service';
import {
  ActualizarAplicacionAgroquimicoDto,
  AplicacionDetalleResponseDto,
  CrearAplicacionAgroquimicoDto,
  ExportarAplicacionesQueryDto,
  ListarAplicacionesQueryDto,
  ListarAplicacionesResponseDto,
} from './dto/agroquimicos.dto';

@ApiTags(SWAGGER_TAGS.AGROQUIMICOS)
@Controller('fincas/:id_finca/agroquimicos')
@UseGuards(JwtAuthGuard, AdminFincaGuard, PermisoGuard)
@RequirePermiso(PERMISO_FINCA.REGISTRO_AGROQUIMICOS)
@ApiAuth()
export class AgroquimicosController {
  constructor(private readonly agroquimicos_service: AgroquimicosService) {}

  @Get('exportar')
  @ApiOperation({
    summary: 'Exportar el historial de aplicaciones de agroquímicos a PDF',
  })
  @ApiProduces('application/pdf')
  @ApiOkResponse({
    description: 'Archivo PDF del historial',
    content: {
      'application/pdf': {
        schema: { type: 'string', format: 'binary' },
      },
    },
  })
  @ApiErrorResponses({ badRequest: true, forbidden: true, notFound: true })
  async exportar(
    @Param('id_finca', ParseIntPipe) id_finca: number,
    @Query() query: ExportarAplicacionesQueryDto,
    @Res({ passthrough: true }) res: Response,
  ): Promise<StreamableFile> {
    const archivo = await this.agroquimicos_service.exportar(id_finca, query);
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader(
      'Content-Disposition',
      `attachment; filename="${archivo.filename}"`,
    );
    return new StreamableFile(archivo.buffer);
  }

  @Get()
  @ApiOperation({
    summary: 'Listar y filtrar aplicaciones de agroquímicos de la finca',
  })
  @ApiOkResponse({ type: ListarAplicacionesResponseDto })
  @ApiErrorResponses({ badRequest: true, forbidden: true, notFound: true })
  listar(
    @Param('id_finca', ParseIntPipe) id_finca: number,
    @Query() query: ListarAplicacionesQueryDto,
  ) {
    return this.agroquimicos_service.listar(id_finca, query);
  }

  @Post()
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({
    summary: 'Registrar una aplicación de agroquímico en una parcela',
  })
  @ApiCreatedResponse({ type: AplicacionDetalleResponseDto })
  @ApiErrorResponses({ badRequest: true, forbidden: true, notFound: true })
  registrar(
    @Param('id_finca', ParseIntPipe) id_finca: number,
    @Body() dto: CrearAplicacionAgroquimicoDto,
    @CurrentUser() actor: Usuario,
  ) {
    return this.agroquimicos_service.registrar(id_finca, dto, actor);
  }

  @Put(':id_aplicacion')
  @ApiOperation({ summary: 'Editar una aplicación de agroquímico registrada' })
  @ApiOkResponse({ type: AplicacionDetalleResponseDto })
  @ApiErrorResponses({
    badRequest: true,
    forbidden: true,
    notFound: true,
    conflict: true,
  })
  actualizar(
    @Param('id_finca', ParseIntPipe) id_finca: number,
    @Param('id_aplicacion', ParseIntPipe) id_aplicacion: number,
    @Body() dto: ActualizarAplicacionAgroquimicoDto,
    @CurrentUser() actor: Usuario,
  ) {
    return this.agroquimicos_service.actualizar(
      id_finca,
      id_aplicacion,
      dto,
      actor,
    );
  }
}
