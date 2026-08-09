import {
  CanActivate,
  ExecutionContext,
  HttpStatus,
  Injectable,
} from '@nestjs/common';
import { CODIGO_ADMIN_FINCA } from '../../../common/enums';
import { DomainException } from '../../../common/exceptions';
import { Usuario } from '../../usuarios/entities/usuario.entity';

/**
 * Requiere JWT + membresía vigente como ADMIN_FINCA en `:id_finca` de la ruta.
 */
@Injectable()
export class AdminFincaGuard implements CanActivate {
  canActivate(context: ExecutionContext): boolean {
    const request = context.switchToHttp().getRequest<{
      user?: Usuario;
      params?: { id_finca?: string };
    }>();
    const usuario = request.user;
    const id_finca = Number(request.params?.id_finca);

    if (!usuario || !Number.isFinite(id_finca) || id_finca <= 0) {
      throw new DomainException(
        'FORBIDDEN',
        'No tenés permisos para realizar esta acción',
        HttpStatus.FORBIDDEN,
      );
    }

    const now = Date.now();
    const es_admin = (usuario.usuario_fincas ?? []).some(
      (uf) =>
        Number(uf.finca?.id_finca) === id_finca &&
        uf.rol_finca?.codigo_rol_finca === CODIGO_ADMIN_FINCA &&
        (uf.fecha_fin_rol == null || uf.fecha_fin_rol.getTime() > now),
    );

    if (!es_admin) {
      throw new DomainException(
        'FORBIDDEN',
        'No tenés permisos para realizar esta acción',
        HttpStatus.FORBIDDEN,
      );
    }

    return true;
  }
}
