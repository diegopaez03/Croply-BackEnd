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
import { PlantillasBaseService } from './plantillas-base.service';
import { CrearPlantillaBaseDto } from './dto/crear-plantilla-base.dto';
import { ListarPlantillasBaseQueryDto } from './dto/listar-plantillas-base-query.dto';
import {
  CrearPlantillaBaseResponseDto,
  ListarPlantillasBaseResponseDto,
  MensajePlantillaResponseDto,
  PlantillaBaseDetalleDto,
} from './dto/plantilla-base-response.dto';

@ApiTags(SWAGGER_TAGS.CULTIVOS)
@Controller('cultivos/plantillas-base')
export class PlantillasBaseController {
  constructor(private readonly plantillas_service: PlantillasBaseService) {}

  @Get()
  @UseGuards(JwtAuthGuard, AdminCroplyOAdminFincaGuard)
  @ApiAuth()
  @ApiOperation({
    summary: 'Listar plantillas de planes base',
    description: 'Listado paginado en formato resumido para cards.',
  })
  @ApiOkResponse({
    description: 'Listado paginado de plantillas',
    type: ListarPlantillasBaseResponseDto,
  })
  @ApiErrorResponses({ forbidden: true })
  listar(@Query() query: ListarPlantillasBaseQueryDto) {
    return this.plantillas_service.listar(query);
  }

  @Post()
  @UseGuards(JwtAuthGuard, AdminCroplyGuard)
  @ApiAuth()
  @ApiOperation({ summary: 'Crear plantilla de plan base' })
  @ApiCreatedResponse({
    description: 'Plantilla creada',
    type: CrearPlantillaBaseResponseDto,
  })
  @ApiErrorResponses({
    badRequest: true,
    conflict: true,
    forbidden: true,
    notFound: true,
  })
  crear(
    @Body() dto: CrearPlantillaBaseDto,
    @CurrentUser() usuario: Usuario,
  ) {
    return this.plantillas_service.crear(dto, usuario);
  }

  @Get(':id_plantilla_base')
  @UseGuards(JwtAuthGuard, AdminCroplyOAdminFincaGuard)
  @ApiAuth()
  @ApiOperation({
    summary: 'Ver detalle de plantilla',
    description: 'Incluye cultivos asociados, hitos y cronograma de tareas.',
  })
  @ApiOkResponse({
    description: 'Detalle de la plantilla',
    type: PlantillaBaseDetalleDto,
  })
  @ApiErrorResponses({ notFound: true, forbidden: true })
  detalle(
    @Param('id_plantilla_base', ParseIntPipe) id_plantilla_base: number,
  ) {
    return this.plantillas_service.detalle(id_plantilla_base);
  }

  @Put(':id_plantilla_base')
  @UseGuards(JwtAuthGuard, AdminCroplyGuard)
  @ApiAuth()
  @ApiOperation({
    summary: 'Editar plantilla de plan base',
    description:
      'Reemplaza cultivos, hitos y tareas. No afecta planes de acción ya generados.',
  })
  @ApiOkResponse({
    description: 'Plantilla actualizada',
    type: CrearPlantillaBaseResponseDto,
  })
  @ApiErrorResponses({
    badRequest: true,
    conflict: true,
    forbidden: true,
    notFound: true,
  })
  actualizar(
    @Param('id_plantilla_base', ParseIntPipe) id_plantilla_base: number,
    @Body() dto: CrearPlantillaBaseDto,
    @CurrentUser() usuario: Usuario,
  ) {
    return this.plantillas_service.actualizar(
      id_plantilla_base,
      dto,
      usuario,
    );
  }

  @Delete(':id_plantilla_base')
  @UseGuards(JwtAuthGuard, AdminCroplyGuard)
  @ApiAuth()
  @ApiOperation({
    summary: 'Dar de baja lógica una plantilla',
    description: 'Permitida aunque la plantilla haya sido usada antes.',
  })
  @ApiOkResponse({
    description: 'Plantilla eliminada',
    type: MensajePlantillaResponseDto,
  })
  @ApiErrorResponses({ notFound: true, forbidden: true })
  dar_baja(
    @Param('id_plantilla_base', ParseIntPipe) id_plantilla_base: number,
    @CurrentUser() usuario: Usuario,
  ) {
    return this.plantillas_service.dar_baja(id_plantilla_base, usuario);
  }
}
