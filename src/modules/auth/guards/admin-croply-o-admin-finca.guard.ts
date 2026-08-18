import {
  CanActivate,
  ExecutionContext,
  HttpStatus,
  Injectable,
} from '@nestjs/common';
import {
  CODIGO_ADMIN_CROPLY,
  CODIGO_ADMIN_FINCA,
} from '../../../common/enums';
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

    if (usuario.rol_sistema?.codigo === CODIGO_ADMIN_CROPLY) {
      return true;
    }

    const now = Date.now();
    const es_admin_finca = (usuario.usuario_fincas ?? []).some(
      (uf) =>
        uf.rol_finca?.codigo_rol_finca === CODIGO_ADMIN_FINCA &&
        (uf.fecha_fin_rol == null || uf.fecha_fin_rol.getTime() > now),
    );

    if (!es_admin_finca) {
      throw new DomainException(
        'FORBIDDEN',
        'No tenés permisos para realizar esta acción',
        HttpStatus.FORBIDDEN,
      );
    }

    return true;
  }
}
