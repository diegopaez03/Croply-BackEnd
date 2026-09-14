import {
  CanActivate,
  ExecutionContext,
  HttpStatus,
  Injectable,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { DomainException } from '../../../common/exceptions';
import { Usuario } from '../../usuarios/entities/usuario.entity';
import { REQUIRE_PERMISO_KEY } from '../decorators/require-permiso.decorator';
import { usuario_tiene_permiso } from '../permisos.util';

@Injectable()
export class PermisoGuard implements CanActivate {
  constructor(private readonly reflector: Reflector) {}

  canActivate(context: ExecutionContext): boolean {
    const requeridos = this.reflector.getAllAndOverride<string[]>(
      REQUIRE_PERMISO_KEY,
      [context.getHandler(), context.getClass()],
    );

    if (!requeridos?.length) {
      return true;
    }

    const request = context.switchToHttp().getRequest<{ user?: Usuario }>();
    if (usuario_tiene_permiso(request.user, ...requeridos)) {
      return true;
    }

    throw new DomainException(
      'FORBIDDEN',
      'No tenés permisos para realizar esta acción',
      HttpStatus.FORBIDDEN,
    );
  }
}
