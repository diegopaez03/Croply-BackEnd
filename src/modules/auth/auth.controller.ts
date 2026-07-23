import {
  Body,
  Controller,
  Get,
  HttpCode,
  HttpStatus,
  Param,
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
import { SWAGGER_TAGS } from '../../common/swagger';
import { ApiAuth, ApiErrorResponses } from '../../common/decorators';
import { AuthService } from './auth.service';
import { LoginDto } from './dto/login.dto';
import { RegistrarAdminFincaDto } from './dto/registrar-admin-finca.dto';
import { RegistrarInvitadoDto } from './dto/registrar-invitado.dto';
import { OlvideMiContrasenaDto } from './dto/olvide-mi-contrasena.dto';
import { ResetearContrasenaDto } from './dto/resetear-contrasena.dto';
import { CambioContrasenaDto } from './dto/cambio-contrasena.dto';
import { ContrasenaPrimerAccesoDto } from './dto/contrasena-primer-acceso.dto';
import { JwtAuthGuard } from './guards/jwt-auth.guard';
import { AdminCroplyGuard } from './guards/admin-croply.guard';
import { CurrentUser } from './decorators/current-user.decorator';
import { Usuario } from '../usuarios/entities/usuario.entity';

@ApiTags(SWAGGER_TAGS.AUTH)
@Controller('auth')
export class AuthController {
  constructor(private readonly auth_service: AuthService) {}

  @Post('login')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Iniciar sesión',
    description: 'Autentica con email y contraseña; devuelve JWT y datos del usuario.',
  })
  @ApiOkResponse({ description: 'Login exitoso' })
  @ApiErrorResponses({
    unauthorized: true,
    forbidden: true,
    badRequest: true,
  })
  login(@Body() dto: LoginDto) {
    return this.auth_service.login(dto);
  }

  @Post('registrar-admin-finca')
  @UseGuards(JwtAuthGuard, AdminCroplyGuard)
  @ApiAuth()
  @ApiOperation({
    summary: 'Registrar administrador de finca',
    description: 'Solo Administrador Croply. Crea usuario con contraseña temporal.',
  })
  @ApiCreatedResponse({ description: 'Usuario registrado' })
  @ApiErrorResponses({
    unauthorized: true,
    forbidden: true,
    conflict: true,
    badRequest: true,
  })
  registrar_admin_finca(@Body() dto: RegistrarAdminFincaDto) {
    return this.auth_service.registrar_admin_finca(dto);
  }

  @Get('validar-invitacion/:token')
  @ApiOperation({
    summary: 'Validar token de invitación',
    description: 'Verifica si el enlace de invitación es válido antes de mostrar el formulario.',
  })
  @ApiOkResponse({ description: 'Token válido' })
  @ApiErrorResponses({
    unauthorized: false,
    gone: true,
    badRequest: false,
  })
  validar_invitacion(@Param('token') token: string) {
    return this.auth_service.validar_invitacion(token);
  }

  @Post('registrar-invitado')
  @ApiOperation({
    summary: 'Completar registro de invitado',
    description: 'Registra al usuario invitado y lo asocia a la finca.',
  })
  @ApiCreatedResponse({ description: 'Registro completado' })
  @ApiErrorResponses({
    unauthorized: false,
    gone: true,
    conflict: true,
    badRequest: true,
  })
  registrar_invitado(@Body() dto: RegistrarInvitadoDto) {
    return this.auth_service.registrar_invitado(dto);
  }

  @Post('olvide-mi-contrasena')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Solicitar recuperación de contraseña',
    description:
      'Siempre responde el mismo mensaje, exista o no la cuenta (seguridad).',
  })
  @ApiOkResponse({ description: 'Mensaje genérico de confirmación' })
  @ApiErrorResponses({ unauthorized: false, badRequest: true })
  olvide_mi_contrasena(@Body() dto: OlvideMiContrasenaDto) {
    return this.auth_service.olvide_mi_contrasena(dto);
  }

  @Post('resetear-contrasena')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Restablecer contraseña con token',
    description: 'Usa el token recibido por correo para definir una nueva contraseña.',
  })
  @ApiOkResponse({ description: 'Contraseña restablecida' })
  @ApiErrorResponses({
    unauthorized: false,
    gone: true,
    badRequest: true,
  })
  resetear_contrasena(@Body() dto: ResetearContrasenaDto) {
    return this.auth_service.resetear_contrasena(dto);
  }

  @Put('cambio-contrasena')
  @UseGuards(JwtAuthGuard)
  @ApiAuth()
  @ApiOperation({
    summary: 'Cambiar contraseña desde el perfil',
    description: 'Requiere autenticación y la contraseña actual.',
  })
  @ApiOkResponse({ description: 'Contraseña actualizada' })
  @ApiErrorResponses({ unauthorized: true, badRequest: true })
  cambio_contrasena(
    @CurrentUser() usuario: Usuario,
    @Body() dto: CambioContrasenaDto,
  ) {
    return this.auth_service.cambio_contrasena(Number(usuario.id_usuario), dto);
  }

  @Put('contrasena-primer-acceso')
  @UseGuards(JwtAuthGuard)
  @ApiAuth()
  @ApiOperation({
    summary: 'Cambiar contraseña en primer acceso',
    description:
      'Flujo forzado tras login con contraseña temporal. Activa la cuenta.',
  })
  @ApiOkResponse({ description: 'Contraseña configurada y cuenta activa' })
  @ApiErrorResponses({ unauthorized: true, badRequest: true })
  contrasena_primer_acceso(
    @CurrentUser() usuario: Usuario,
    @Body() dto: ContrasenaPrimerAccesoDto,
  ) {
    return this.auth_service.contrasena_primer_acceso(
      Number(usuario.id_usuario),
      dto,
    );
  }
}
