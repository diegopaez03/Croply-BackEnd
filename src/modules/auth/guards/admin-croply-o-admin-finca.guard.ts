import {
  CanActivate,
  ExecutionContext,
  HttpStatus,
  Injectable,
} from '@nestjs/common';
import { DomainException } from '../../../common/exceptions';
import { Usuario } from '../../usuarios/entities/usuario.entity';

/**
 * Biblioteca global (Épica 4): Admin Croply o Admin de Finca vigente
 * en cualquier finca. No exige `:id_finca` en la URL.
 */
@Injectable()
export class AdminCroplyOAdminFincaGuard implements CanActivate {
  canActivate(context: ExecutionContext): boolean {
    const request = context.switchToHttp().getRequest<{ user?: Usuario }>();
    const usuario = request.user;

    if (!usuario) {
      throw new DomainException(
        'FORBIDDEN',
        'No tenés permisos para realizar esta acción',
        HttpStatus.FORBIDDEN,
      );
    }

    if (usuario.rol_sistema) {
      return true;
    }

    const now = Date.now();
    const pertenece_a_finca = (usuario.usuario_fincas ?? []).some(
      (uf) => uf.fecha_fin_rol == null || uf.fecha_fin_rol.getTime() > now,
    );

    if (!pertenece_a_finca) {
      throw new DomainException(
        'FORBIDDEN',
        'No tenés permisos para realizar esta acción',
        HttpStatus.FORBIDDEN,
      );
    }

    return true;
  }
}
