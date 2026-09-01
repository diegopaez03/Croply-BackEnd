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
import { SWAGGER_TAGS } from '../../common/swagger';
import { AdminCroplyGuard } from '../auth/guards/admin-croply.guard';
import { AdminCroplyOAdminFincaGuard } from '../auth/guards/admin-croply-o-admin-finca.guard';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { Usuario } from '../usuarios/entities/usuario.entity';
import { CultivosBaseService } from './cultivos-base.service';
import { CrearCultivoBaseDto } from './dto/crear-cultivo-base.dto';
import { CrearVariedadDto } from './dto/crear-variedad.dto';
import {
  CrearCultivoBaseResponseDto,
  CultivoBaseDetalleDto,
  ListarCultivosBaseResponseDto,
  MensajeCultivoResponseDto,
  VariedadMutacionResponseDto,
} from './dto/cultivo-base-response.dto';
import { ListarCultivosBaseQueryDto } from './dto/listar-cultivos-base-query.dto';

@ApiTags(SWAGGER_TAGS.CULTIVOS)
@Controller('cultivos/base')
export class CultivosBaseController {
  constructor(private readonly cultivos_service: CultivosBaseService) {}

  @Get()
  @UseGuards(JwtAuthGuard, AdminCroplyOAdminFincaGuard)
  @ApiAuth()
  @ApiOperation({
    summary: 'Listar cultivos de la biblioteca',
    description:
      'Búsqueda por nombre (`search`) y filtros opcionales `epoca_cultivo` y `forma_siembra`. Compartido por HU-BC-01/03/04/05.',
  })
  @ApiOkResponse({
    description: 'Listado de cultivos activos',
    type: ListarCultivosBaseResponseDto,
  })
  @ApiErrorResponses({ forbidden: true })
  listar(@Query() query: ListarCultivosBaseQueryDto) {
    return this.cultivos_service.listar(query);
  }

  @Post()
  @UseGuards(JwtAuthGuard, AdminCroplyGuard)
  @ApiAuth()
  @ApiOperation({ summary: 'Crear cultivo base' })
  @ApiCreatedResponse({
    description: 'Cultivo creado',
    type: CrearCultivoBaseResponseDto,
  })
  @ApiErrorResponses({ badRequest: true, conflict: true, forbidden: true })
  crear(@Body() dto: CrearCultivoBaseDto, @CurrentUser() usuario: Usuario) {
    return this.cultivos_service.crear(dto, usuario);
  }

  @Get(':id_cultivo_base')
  @UseGuards(JwtAuthGuard, AdminCroplyOAdminFincaGuard)
  @ApiAuth()
  @ApiOperation({
    summary: 'Ver detalle de cultivo',
    description:
      'Ficha técnica, variedades y referencias calculadas de plantilla general/específica.',
  })
  @ApiOkResponse({
    description: 'Detalle del cultivo',
    type: CultivoBaseDetalleDto,
  })
  @ApiErrorResponses({ notFound: true, forbidden: true })
  detalle(
    @Param('id_cultivo_base', ParseIntPipe) id_cultivo_base: number,
  ) {
    return this.cultivos_service.detalle(id_cultivo_base);
  }

  @Put(':id_cultivo_base')
  @UseGuards(JwtAuthGuard, AdminCroplyGuard)
  @ApiAuth()
  @ApiOperation({ summary: 'Editar ficha técnica del cultivo' })
  @ApiOkResponse({
    description: 'Cultivo actualizado',
    type: CrearCultivoBaseResponseDto,
  })
  @ApiErrorResponses({
    badRequest: true,
    notFound: true,
    conflict: true,
    forbidden: true,
  })
  actualizar(
    @Param('id_cultivo_base', ParseIntPipe) id_cultivo_base: number,
    @Body() dto: CrearCultivoBaseDto,
    @CurrentUser() usuario: Usuario,
  ) {
    return this.cultivos_service.actualizar(id_cultivo_base, dto, usuario);
  }

  @Delete(':id_cultivo_base')
  @UseGuards(JwtAuthGuard, AdminCroplyGuard)
  @ApiAuth()
  @ApiOperation({ summary: 'Dar de baja lógica un cultivo' })
  @ApiOkResponse({
    description: 'Cultivo eliminado',
    type: MensajeCultivoResponseDto,
  })
  @ApiErrorResponses({ notFound: true, conflict: true, forbidden: true })
  dar_baja(
    @Param('id_cultivo_base', ParseIntPipe) id_cultivo_base: number,
    @CurrentUser() usuario: Usuario,
  ) {
    return this.cultivos_service.dar_baja(id_cultivo_base, usuario);
  }

  @Post(':id_cultivo_base/variedades')
  @UseGuards(JwtAuthGuard, AdminCroplyGuard)
  @ApiAuth()
  @ApiOperation({ summary: 'Agregar variedad a un cultivo' })
  @ApiCreatedResponse({
    description: 'Variedad agregada',
    type: VariedadMutacionResponseDto,
  })
  @ApiErrorResponses({
    badRequest: true,
    notFound: true,
    conflict: true,
    forbidden: true,
  })
  agregar_variedad(
    @Param('id_cultivo_base', ParseIntPipe) id_cultivo_base: number,
    @Body() dto: CrearVariedadDto,
    @CurrentUser() usuario: Usuario,
  ) {
    return this.cultivos_service.agregar_variedad(
      id_cultivo_base,
      dto,
      usuario,
    );
  }

  @Put(':id_cultivo_base/variedades/:id_variedad')
  @UseGuards(JwtAuthGuard, AdminCroplyGuard)
  @ApiAuth()
  @ApiOperation({ summary: 'Editar variedad' })
  @ApiOkResponse({
    description: 'Variedad actualizada',
    type: VariedadMutacionResponseDto,
  })
  @ApiErrorResponses({
    badRequest: true,
    notFound: true,
    conflict: true,
    forbidden: true,
  })
  actualizar_variedad(
    @Param('id_cultivo_base', ParseIntPipe) id_cultivo_base: number,
    @Param('id_variedad', ParseIntPipe) id_variedad: number,
    @Body() dto: CrearVariedadDto,
    @CurrentUser() usuario: Usuario,
  ) {
    return this.cultivos_service.actualizar_variedad(
      id_cultivo_base,
      id_variedad,
      dto,
      usuario,
    );
  }

  @Delete(':id_cultivo_base/variedades/:id_variedad')
  @UseGuards(JwtAuthGuard, AdminCroplyGuard)
  @ApiAuth()
  @ApiOperation({ summary: 'Dar de baja lógica una variedad' })
  @ApiOkResponse({
    description: 'Variedad eliminada',
    type: MensajeCultivoResponseDto,
  })
  @ApiErrorResponses({ notFound: true, conflict: true, forbidden: true })
  dar_baja_variedad(
    @Param('id_cultivo_base', ParseIntPipe) id_cultivo_base: number,
    @Param('id_variedad', ParseIntPipe) id_variedad: number,
    @CurrentUser() usuario: Usuario,
  ) {
    return this.cultivos_service.dar_baja_variedad(
      id_cultivo_base,
      id_variedad,
      usuario,
    );
  }
}
