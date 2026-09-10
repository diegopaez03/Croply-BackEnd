import {
  Body,
  Controller,
  Get,
  Param,
  ParseIntPipe,
  Put,
  Query,
  UseGuards,
} from '@nestjs/common';
import {
  ApiOkResponse,
  ApiOperation,
  ApiTags,
} from '@nestjs/swagger';
import { ApiAuth, ApiErrorResponses } from '../../common/decorators';
import { SWAGGER_TAGS } from '../../common/swagger';
import { AdminCroplyGuard } from '../auth/guards/admin-croply.guard';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { PermisoGuard } from '../auth/guards/permiso.guard';
import { RequirePermiso } from '../auth/decorators/require-permiso.decorator';
import { PERMISO_FINCA, PERMISO_SISTEMA } from '../../common/enums';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { Usuario } from './entities/usuario.entity';
import {
  ActualizarEstadoUsuarioDto,
  ActualizarPerfilDto,
  AsignarRolSistemaBodyDto,
  ListarUsuariosQueryDto,
} from './dto/usuarios.dto';
import { UsuariosService } from './usuarios.service';

@ApiTags(SWAGGER_TAGS.USUARIOS)
@Controller('usuarios')
export class UsuariosController {
  constructor(private readonly usuarios_service: UsuariosService) {}

  @Get('me')
  @UseGuards(JwtAuthGuard)
  @ApiAuth()
  @ApiOperation({ summary: 'Obtener perfil propio' })
  @ApiOkResponse({ description: 'Perfil del usuario autenticado' })
  @ApiErrorResponses()
  me(@CurrentUser() usuario: Usuario) {
    return this.usuarios_service.get_me(usuario);
  }

  @Put('me')
  @UseGuards(JwtAuthGuard)
  @ApiAuth()
  @ApiOperation({ summary: 'Actualizar perfil propio' })
  @ApiOkResponse({ description: 'Perfil actualizado' })
  @ApiErrorResponses({ badRequest: true })
  update_me(
    @CurrentUser() usuario: Usuario,
    @Body() dto: ActualizarPerfilDto,
  ) {
    return this.usuarios_service.update_me(usuario, dto);
  }

  @Get()
  @UseGuards(JwtAuthGuard, AdminCroplyGuard, PermisoGuard)
  @RequirePermiso(PERMISO_SISTEMA.GESTION_USUARIOS)
  @ApiAuth()
  @ApiOperation({ summary: 'Listar usuarios (ámbito Croply)' })
  @ApiOkResponse({ description: 'Listado paginado de administradores' })
  @ApiErrorResponses()
  listar(@Query() query: ListarUsuariosQueryDto) {
    return this.usuarios_service.listar_ambito_croply(query);
  }

  @Put(':id_usuario/rol-sistema')
  @UseGuards(JwtAuthGuard, AdminCroplyGuard, PermisoGuard)
  @RequirePermiso(PERMISO_SISTEMA.GESTION_USUARIOS)
  @ApiAuth()
  @ApiOperation({ summary: 'Asignar rol de sistema a usuario' })
  @ApiOkResponse({ description: 'Rol asignado' })
  @ApiErrorResponses({ notFound: true })
  asignar_rol_sistema(
    @Param('id_usuario', ParseIntPipe) id_usuario: number,
    @Body() dto: AsignarRolSistemaBodyDto,
    @CurrentUser() actor: Usuario,
  ) {
    return this.usuarios_service.asignar_rol_sistema(
      id_usuario,
      dto.id_rol,
      actor,
    );
  }

  @Put(':id_usuario/estado')
  @UseGuards(JwtAuthGuard, PermisoGuard)
  @RequirePermiso(
    PERMISO_SISTEMA.GESTION_USUARIOS,
    PERMISO_FINCA.GESTION_TRABAJADORES,
  )
  @ApiAuth()
  @ApiOperation({ summary: 'Administrar estado de cuenta de usuario' })
  @ApiOkResponse({ description: 'Estado actualizado' })
  @ApiErrorResponses({ notFound: true })
  actualizar_estado(
    @Param('id_usuario', ParseIntPipe) id_usuario: number,
    @Body() dto: ActualizarEstadoUsuarioDto,
    @CurrentUser() actor: Usuario,
  ) {
    return this.usuarios_service.actualizar_estado(id_usuario, dto, actor);
  }
}
