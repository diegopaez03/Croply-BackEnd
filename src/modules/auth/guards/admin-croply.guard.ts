import {
  CanActivate,
  ExecutionContext,
  Injectable,
} from '@nestjs/common';
import { DomainException } from '../../../common/exceptions';
import { HttpStatus } from '@nestjs/common';
import { Usuario } from '../../usuarios/entities/usuario.entity';

@Injectable()
export class AdminCroplyGuard implements CanActivate {
  canActivate(context: ExecutionContext): boolean {
    const request = context.switchToHttp().getRequest<{ user?: Usuario }>();
    const usuario = request.user;
    if (!usuario?.rol_sistema) {
      throw new DomainException(
        'FORBIDDEN',
        'No tenés permisos para realizar esta acción',
        HttpStatus.FORBIDDEN,
      );
    }
    return true;
  }
}
