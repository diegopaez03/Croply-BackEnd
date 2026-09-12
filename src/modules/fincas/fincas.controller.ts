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
import { AdminFincaGuard } from '../auth/guards/admin-finca.guard';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
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
  ActualizarFincaDto,
  AsignarPropietarioDto,
  CrearFincaDto,
  CrearInvitacionDto,
  ListarFincasQueryDto,
  ListarUsuariosFincaQueryDto,
} from './dto/fincas.dto';
import { FincasService } from './fincas.service';
import { ClimaService } from './clima.service';

@ApiTags(SWAGGER_TAGS.FINCAS)
@Controller('fincas')
export class FincasController {
  constructor(
    private readonly fincas_service: FincasService,
    private readonly clima_service: ClimaService,
    private readonly roles_service: RolesService,
    private readonly usuarios_service: UsuariosService,
  ) {}

  @Get('stats')
  @UseGuards(JwtAuthGuard, AdminCroplyGuard)
  @ApiAuth()
  @ApiOperation({ summary: 'Obtener métricas agregadas de fincas' })
  @ApiOkResponse({ description: 'Métricas de fincas' })
  @ApiErrorResponses()
  stats() {
    return this.fincas_service.obtener_stats();
  }

  @Get()
  @UseGuards(JwtAuthGuard, AdminCroplyGuard)
  @ApiAuth()
  @ApiOperation({ summary: 'Listar fincas' })
  @ApiOkResponse({ description: 'Listado paginado de fincas' })
  @ApiErrorResponses({ badRequest: true })
  listar(@Query() query: ListarFincasQueryDto) {
    return this.fincas_service.listar_fincas(query);
  }

  @Post()
  @UseGuards(JwtAuthGuard, AdminCroplyGuard)
  @ApiAuth()
  @ApiOperation({ summary: 'Crear finca' })
  @ApiCreatedResponse({ description: 'Finca creada' })
  @ApiErrorResponses({ badRequest: true, conflict: true })
  crear(@Body() dto: CrearFincaDto, @CurrentUser() actor: Usuario) {
    return this.fincas_service.crear_finca_desde_dto(dto, actor);
  }

  @Get('mis-fincas')
  @UseGuards(JwtAuthGuard)
  @ApiAuth()
  @ApiOperation({
    summary: 'Listar las fincas del usuario autenticado',
    description:
      'Alimenta el selector de finca activa. Devuelve una entrada por vinculación vigente.',
  })
  @ApiOkResponse({ description: 'Fincas del usuario' })
  @ApiErrorResponses()
  mis_fincas(@CurrentUser() usuario: Usuario) {
    return this.fincas_service.listar_mis_fincas(usuario);
  }

  @Get('usuarios')
  @UseGuards(JwtAuthGuard)
  @ApiAuth()
  @ApiOperation({
    summary: 'Listar usuarios de todas las fincas administradas',
    description:
      'Vista multi-finca: cada fila incluye la finca a la que pertenece la vinculación. `id_finca` acota el listado a una finca puntual.',
  })
  @ApiOkResponse({ description: 'Listado paginado' })
  @ApiErrorResponses({ forbidden: true, notFound: true })
  listar_usuarios_multi_finca(
    @Query() query: ListarUsuariosFincaQueryDto,
    @CurrentUser() usuario: Usuario,
  ) {
    const ids_finca = this.fincas_service.resolver_fincas_administradas(
      usuario,
      query.id_finca,
    );
    return this.usuarios_service.listar_ambito_finca(ids_finca, query);
  }

  @Put(':id_finca/propietario')
  @UseGuards(JwtAuthGuard, AdminCroplyGuard)
  @ApiAuth()
  @ApiOperation({ summary: 'Asignar o reemplazar propietario de finca' })
  @ApiOkResponse({ description: 'Propietario actualizado' })
  @ApiErrorResponses({ notFound: true })
  asignar_propietario(
    @Param('id_finca', ParseIntPipe) id_finca: number,
    @Body() dto: AsignarPropietarioDto,
    @CurrentUser() actor: Usuario,
  ) {
    return this.fincas_service.asignar_propietario(
      id_finca,
      dto.id_usuario_propietario,
      actor,
    );
  }

  @Get(':id_finca')
  @UseGuards(JwtAuthGuard, AdminCroplyGuard)
  @ApiAuth()
  @ApiOperation({ summary: 'Ver detalle de finca' })
  @ApiOkResponse({ description: 'Detalle de finca' })
  @ApiErrorResponses({ notFound: true })
  detalle(@Param('id_finca', ParseIntPipe) id_finca: number) {
    return this.fincas_service.obtener_detalle(id_finca);
  }

  @Get(':id_finca/clima')
  @UseGuards(JwtAuthGuard, AdminFincaGuard)
  @ApiAuth()
  @ApiOperation({ summary: 'Consultar clima actual y pronóstico de finca' })
  @ApiOkResponse({ description: 'Clima actual y pronóstico de cuatro días' })
  @ApiErrorResponses({ forbidden: true, notFound: true })
  clima(@Param('id_finca', ParseIntPipe) id_finca: number) {
    return this.clima_service.obtener_clima(id_finca);
  }

  @Get(':id_finca/resumen')
  @UseGuards(JwtAuthGuard, AdminFincaGuard)
  @ApiAuth()
  @ApiOperation({ summary: 'Consultar resumen de finca' })
  @ApiOkResponse({ description: 'Resumen de finca' })
  @ApiErrorResponses({ forbidden: true, notFound: true })
  resumen(@Param('id_finca', ParseIntPipe) id_finca: number) {
    return this.fincas_service.resumen(id_finca);
  }

  @Put(':id_finca')
  @UseGuards(JwtAuthGuard, AdminCroplyGuard)
  @ApiAuth()
  @ApiOperation({ summary: 'Editar finca' })
  @ApiOkResponse({ description: 'Finca actualizada' })
  @ApiErrorResponses({ badRequest: true, conflict: true, notFound: true })
  actualizar(
    @Param('id_finca', ParseIntPipe) id_finca: number,
    @Body() dto: ActualizarFincaDto,
    @CurrentUser() actor: Usuario,
  ) {
    return this.fincas_service.actualizar_finca(id_finca, dto, actor);
  }

  @Delete(':id_finca')
  @UseGuards(JwtAuthGuard, AdminCroplyGuard)
  @ApiAuth()
  @ApiOperation({ summary: 'Dar de baja finca' })
  @ApiOkResponse({ description: 'Finca dada de baja' })
  @ApiErrorResponses({ notFound: true })
  dar_baja(
    @Param('id_finca', ParseIntPipe) id_finca: number,
    @CurrentUser() actor: Usuario,
  ) {
    return this.fincas_service.dar_baja_finca(id_finca, actor);
  }

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
    return this.usuarios_service.listar_ambito_finca([id_finca], query);
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
