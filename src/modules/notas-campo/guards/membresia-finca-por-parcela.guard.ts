import {
  CanActivate,
  ExecutionContext,
  HttpStatus,
  Injectable,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { IsNull, Repository } from 'typeorm';
import { DomainException, resourceNotFound } from '../../../common/exceptions';
import { Parcela } from '../../parcelas/entities/parcela.entity';
import { Usuario } from '../../usuarios/entities/usuario.entity';

/**
 * Membresía vigente en la finca dueña de `:id_parcela`.
 * No exige rol Administrador de Finca.
 */
@Injectable()
export class MembresiaFincaPorParcelaGuard implements CanActivate {
  constructor(
    @InjectRepository(Parcela)
    private readonly parcela_repo: Repository<Parcela>,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest<{
      user?: Usuario;
      params?: { id_parcela?: string };
    }>();
    const usuario = request.user;
    const id_parcela = Number(request.params?.id_parcela);

    if (!usuario || !Number.isFinite(id_parcela) || id_parcela <= 0) {
      throw this.forbidden();
    }

    const parcela = await this.parcela_repo.findOne({
      where: { id_parcela, fecha_baja_parcela: IsNull() },
      relations: ['finca'],
    });
    if (!parcela?.finca || parcela.finca.fecha_baja_finca != null) {
      throw resourceNotFound();
    }

    const now = Date.now();
    const pertenece = (usuario.usuario_fincas ?? []).some(
      (uf) =>
        Number(uf.finca?.id_finca) === Number(parcela.finca.id_finca) &&
        (uf.fecha_fin_rol == null || uf.fecha_fin_rol.getTime() > now),
    );
    if (!pertenece) {
      throw this.forbidden();
    }
    return true;
  }

  private forbidden(): DomainException {
    return new DomainException(
      'FORBIDDEN',
      'No tenés permisos para realizar esta acción',
      HttpStatus.FORBIDDEN,
    );
  }
}
