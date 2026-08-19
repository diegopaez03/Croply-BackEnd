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
import { SWAGGER_TAGS } from '../../common/swagger';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { AdminCroplyGuard } from '../auth/guards/admin-croply.guard';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { Usuario } from '../usuarios/entities/usuario.entity';
import { ActualizarTipoSensorDto } from './dto/actualizar-tipo-sensor.dto';
import { CrearTipoSensorDto } from './dto/crear-tipo-sensor.dto';
import { TiposSensorService } from './tipos-sensor.service';

@ApiTags(SWAGGER_TAGS.TIPOS_SENSOR)
@Controller('tipos-sensor')
export class TiposSensorController {
  constructor(private readonly tipos_sensor_service: TiposSensorService) {}

  @Get('codigos-disponibles')
  @UseGuards(JwtAuthGuard, AdminCroplyGuard)
  @ApiAuth()
  @ApiOperation({ summary: 'Listar códigos disponibles de tipos de sensor' })
  @ApiOkResponse({ description: 'Catálogo de códigos de tipos de sensor' })
  @ApiErrorResponses({ badRequest: false, forbidden: true })
  codigos_disponibles() {
    return {
      codigos_tipo_sensor: this.tipos_sensor_service.codigos_disponibles(),
    };
  }

  @Get()
  @UseGuards(JwtAuthGuard, AdminCroplyGuard)
  @ApiAuth()
  @ApiOperation({ summary: 'Listar tipos de sensor' })
  @ApiOkResponse({ description: 'Listado de tipos de sensor' })
  @ApiErrorResponses({ forbidden: true })
  listar() {
    return this.tipos_sensor_service.listar();
  }

  @Post()
  @UseGuards(JwtAuthGuard, AdminCroplyGuard)
  @ApiAuth()
  @ApiOperation({ summary: 'Crear tipo de sensor' })
  @ApiCreatedResponse({ description: 'Tipo de sensor creado' })
  @ApiErrorResponses({ forbidden: true })
  crear(
    @Body() dto: CrearTipoSensorDto,
    @CurrentUser() usuario: Usuario,
  ) {
    return this.tipos_sensor_service.crear(dto, usuario);
  }

  @Put(':id_tipo_sensor')
  @UseGuards(JwtAuthGuard, AdminCroplyGuard)
  @ApiAuth()
  @ApiOperation({ summary: 'Editar tipo de sensor' })
  @ApiOkResponse({ description: 'Tipo de sensor actualizado' })
  @ApiErrorResponses({ forbidden: true, notFound: true })
  actualizar(
    @Param('id_tipo_sensor', ParseIntPipe) id_tipo_sensor: number,
    @Body() dto: ActualizarTipoSensorDto,
    @CurrentUser() usuario: Usuario,
  ) {
    return this.tipos_sensor_service.actualizar(
      id_tipo_sensor,
      dto,
      usuario,
    );
  }

  @Delete(':id_tipo_sensor')
  @UseGuards(JwtAuthGuard, AdminCroplyGuard)
  @ApiAuth()
  @ApiOperation({ summary: 'Dar de baja tipo de sensor' })
  @ApiOkResponse({ description: 'Tipo de sensor dado de baja' })
  @ApiErrorResponses({ forbidden: true, notFound: true, conflict: true })
  dar_baja(
    @Param('id_tipo_sensor', ParseIntPipe) id_tipo_sensor: number,
    @CurrentUser() usuario: Usuario,
  ) {
    return this.tipos_sensor_service.dar_baja(id_tipo_sensor, usuario);
  }
}
