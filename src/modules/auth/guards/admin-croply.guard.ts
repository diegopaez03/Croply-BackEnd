import {
  CanActivate,
  ExecutionContext,
  Injectable,
} from '@nestjs/common';
import { CODIGO_ADMIN_CROPLY } from '../../../common/enums';
import { DomainException } from '../../../common/exceptions';
import { HttpStatus } from '@nestjs/common';
import { Usuario } from '../../usuarios/entities/usuario.entity';

@Injectable()
export class AdminCroplyGuard implements CanActivate {
  canActivate(context: ExecutionContext): boolean {
    const request = context.switchToHttp().getRequest<{ user?: Usuario }>();
    const usuario = request.user;
    if (usuario?.rol_sistema?.codigo !== CODIGO_ADMIN_CROPLY) {
      throw new DomainException(
        'FORBIDDEN',
        'No tenés permisos para realizar esta acción',
        HttpStatus.FORBIDDEN,
      );
    }
    return true;
  }
}
