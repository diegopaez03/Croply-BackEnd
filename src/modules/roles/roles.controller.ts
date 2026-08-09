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
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { Usuario } from '../usuarios/entities/usuario.entity';
import {
  ActualizarPermisosDto,
  CrearRolSistemaDto,
} from './dto/crear-rol.dto';
import { ListarPermisosQueryDto } from './dto/listar-permisos-query.dto';
import { RolesService } from './roles.service';

@ApiTags(SWAGGER_TAGS.ROLES)
@Controller('roles')
export class RolesController {
  constructor(private readonly roles_service: RolesService) {}

  @Get('sistema')
  @UseGuards(JwtAuthGuard, AdminCroplyGuard)
  @ApiAuth()
  @ApiOperation({ summary: 'Listar roles de sistema' })
  @ApiOkResponse({ description: 'Listado de roles de sistema' })
  @ApiErrorResponses()
  listar_sistema() {
    return this.roles_service.listar_roles_sistema();
  }

  @Post('sistema')
  @UseGuards(JwtAuthGuard, AdminCroplyGuard)
  @ApiAuth()
  @ApiOperation({ summary: 'Crear rol de sistema' })
  @ApiCreatedResponse({ description: 'Rol creado' })
  @ApiErrorResponses({ badRequest: true })
  crear_sistema(
    @Body() dto: CrearRolSistemaDto,
    @CurrentUser() usuario: Usuario,
  ) {
    return this.roles_service.crear_rol_sistema(dto, usuario);
  }

  @Put('sistema/:id_rol')
  @UseGuards(JwtAuthGuard, AdminCroplyGuard)
  @ApiAuth()
  @ApiOperation({ summary: 'Editar rol de sistema' })
  @ApiOkResponse({ description: 'Rol actualizado' })
  @ApiErrorResponses({ badRequest: true, notFound: true })
  actualizar_sistema(
    @Param('id_rol', ParseIntPipe) id_rol: number,
    @Body() dto: CrearRolSistemaDto,
    @CurrentUser() usuario: Usuario,
  ) {
    return this.roles_service.actualizar_rol_sistema(id_rol, dto, usuario);
  }

  @Delete('sistema/:id_rol')
  @UseGuards(JwtAuthGuard, AdminCroplyGuard)
  @ApiAuth()
  @ApiOperation({ summary: 'Dar de baja rol de sistema' })
  @ApiOkResponse({ description: 'Rol dado de baja' })
  @ApiErrorResponses({ notFound: true })
  dar_baja_sistema(
    @Param('id_rol', ParseIntPipe) id_rol: number,
    @CurrentUser() usuario: Usuario,
  ) {
    return this.roles_service.dar_baja_rol_sistema(id_rol, usuario);
  }

  @Get('permisos')
  @UseGuards(JwtAuthGuard)
  @ApiAuth()
  @ApiOperation({ summary: 'Catálogo de permisos por ámbito' })
  @ApiOkResponse({ description: 'Listado de permisos' })
  @ApiErrorResponses({ badRequest: true })
  listar_permisos(@Query() query: ListarPermisosQueryDto) {
    return this.roles_service.listar_permisos(query.ambito);
  }

  @Put('sistema/:id_rol/permisos')
  @UseGuards(JwtAuthGuard, AdminCroplyGuard)
  @ApiAuth()
  @ApiOperation({ summary: 'Guardar permisos de un rol de sistema' })
  @ApiOkResponse({ description: 'Permisos actualizados' })
  @ApiErrorResponses({ badRequest: true, notFound: true })
  actualizar_permisos_sistema(
    @Param('id_rol', ParseIntPipe) id_rol: number,
    @Body() dto: ActualizarPermisosDto,
    @CurrentUser() usuario: Usuario,
  ) {
    return this.roles_service.actualizar_permisos_rol_sistema(
      id_rol,
      dto,
      usuario,
    );
  }
}
