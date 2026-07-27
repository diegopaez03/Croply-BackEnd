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
import {
  AdminFincaGuard,
  CurrentUser,
  JwtAuthGuard,
} from '../auth';
import { Usuario } from '../usuarios/entities/usuario.entity';
import { UsuariosService } from '../usuarios/usuarios.service';
import { RolesService } from '../roles/roles.service';
import {
  ActualizarPermisosDto,
  CrearRolFincaDto,
} from '../roles/dto/crear-rol.dto';
import { ListarUsuariosQueryDto } from '../usuarios/dto/usuarios.dto';
import {
  AsignarRolUsuarioFincaDto,
  CrearInvitacionDto,
} from './dto/fincas.dto';
import { FincasService } from './fincas.service';

@ApiTags(SWAGGER_TAGS.FINCAS)
@Controller('fincas')
export class FincasController {
  constructor(
    private readonly fincas_service: FincasService,
    private readonly roles_service: RolesService,
    private readonly usuarios_service: UsuariosService,
  ) {}

  @Get(':id_finca/roles')
  @UseGuards(JwtAuthGuard, AdminFincaGuard)
  @ApiAuth()
  @ApiOperation({ summary: 'Listar roles de la finca' })
  @ApiOkResponse({ description: 'Roles de finca' })
  @ApiErrorResponses({ forbidden: true })
  listar_roles(@Param('id_finca', ParseIntPipe) id_finca: number) {
    return this.roles_service.listar_roles_finca(id_finca);
  }

  @Post(':id_finca/roles')
  @UseGuards(JwtAuthGuard, AdminFincaGuard)
  @ApiAuth()
  @ApiOperation({ summary: 'Crear rol de finca' })
  @ApiCreatedResponse({ description: 'Rol creado' })
  @ApiErrorResponses({ badRequest: true, forbidden: true })
  async crear_rol(
    @Param('id_finca', ParseIntPipe) id_finca: number,
    @Body() dto: CrearRolFincaDto,
    @CurrentUser() usuario: Usuario,
  ) {
    const finca = await this.fincas_service.require_finca(id_finca);
    return this.roles_service.crear_rol_finca(id_finca, dto, usuario, finca);
  }

  @Put(':id_finca/roles/:id_rol')
  @UseGuards(JwtAuthGuard, AdminFincaGuard)
  @ApiAuth()
  @ApiOperation({ summary: 'Editar rol de finca' })
  @ApiOkResponse({ description: 'Rol actualizado' })
  @ApiErrorResponses({ badRequest: true, notFound: true, forbidden: true })
  actualizar_rol(
    @Param('id_finca', ParseIntPipe) id_finca: number,
    @Param('id_rol', ParseIntPipe) id_rol: number,
    @Body() dto: CrearRolFincaDto,
    @CurrentUser() usuario: Usuario,
  ) {
    return this.roles_service.actualizar_rol_finca(
      id_finca,
      id_rol,
      dto,
      usuario,
    );
  }

  @Delete(':id_finca/roles/:id_rol')
  @UseGuards(JwtAuthGuard, AdminFincaGuard)
  @ApiAuth()
  @ApiOperation({ summary: 'Dar de baja rol de finca' })
  @ApiOkResponse({ description: 'Rol dado de baja' })
  @ApiErrorResponses({ notFound: true, conflict: true, forbidden: true })
  dar_baja_rol(
    @Param('id_finca', ParseIntPipe) id_finca: number,
    @Param('id_rol', ParseIntPipe) id_rol: number,
    @CurrentUser() usuario: Usuario,
  ) {
    return this.roles_service.dar_baja_rol_finca(id_finca, id_rol, usuario);
  }

  @Put(':id_finca/roles/:id_rol/permisos')
  @UseGuards(JwtAuthGuard, AdminFincaGuard)
  @ApiAuth()
  @ApiOperation({ summary: 'Guardar permisos de un rol de finca' })
  @ApiOkResponse({ description: 'Permisos actualizados' })
  @ApiErrorResponses({ badRequest: true, notFound: true, forbidden: true })
  actualizar_permisos(
    @Param('id_finca', ParseIntPipe) id_finca: number,
    @Param('id_rol', ParseIntPipe) id_rol: number,
    @Body() dto: ActualizarPermisosDto,
    @CurrentUser() usuario: Usuario,
  ) {
    return this.roles_service.actualizar_permisos_rol_finca(
      id_finca,
      id_rol,
      dto,
      usuario,
    );
  }

  @Put(':id_finca/usuarios/:id_usuario_finca/rol')
  @UseGuards(JwtAuthGuard, AdminFincaGuard)
  @ApiAuth()
  @ApiOperation({ summary: 'Asignar rol a usuario dentro de la finca' })
  @ApiOkResponse({ description: 'Rol asignado' })
  @ApiErrorResponses({ notFound: true, forbidden: true })
  asignar_rol_usuario(
    @Param('id_finca', ParseIntPipe) id_finca: number,
    @Param('id_usuario_finca', ParseIntPipe) id_usuario_finca: number,
    @Body() dto: AsignarRolUsuarioFincaDto,
    @CurrentUser() usuario: Usuario,
  ) {
    return this.fincas_service.asignar_rol_usuario_finca(
      id_finca,
      id_usuario_finca,
      dto.id_rol,
      usuario,
    );
  }

  @Get(':id_finca/usuarios')
  @UseGuards(JwtAuthGuard, AdminFincaGuard)
  @ApiAuth()
  @ApiOperation({ summary: 'Listar usuarios vinculados a la finca' })
  @ApiOkResponse({ description: 'Listado paginado' })
  @ApiErrorResponses({ forbidden: true })
  listar_usuarios(
    @Param('id_finca', ParseIntPipe) id_finca: number,
    @Query() query: ListarUsuariosQueryDto,
  ) {
    return this.usuarios_service.listar_ambito_finca(id_finca, query);
  }

  @Post(':id_finca/invitaciones')
  @UseGuards(JwtAuthGuard, AdminFincaGuard)
  @ApiAuth()
  @ApiOperation({ summary: 'Generar y enviar invitación por email' })
  @ApiCreatedResponse({ description: 'Invitación enviada' })
  @ApiErrorResponses({
    badRequest: true,
    conflict: true,
    forbidden: true,
    notFound: true,
  })
  crear_invitacion(
    @Param('id_finca', ParseIntPipe) id_finca: number,
    @Body() dto: CrearInvitacionDto,
    @CurrentUser() usuario: Usuario,
  ) {
    return this.fincas_service.crear_invitacion(id_finca, dto, usuario);
  }
}
