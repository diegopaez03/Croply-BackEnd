import {
  CanActivate,
  ExecutionContext,
  HttpStatus,
  Injectable,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { IsNull, Repository } from 'typeorm';
import { CODIGO_ADMIN_FINCA } from '../../../common/enums';
import { DomainException } from '../../../common/exceptions';
import { Parcela } from '../../parcelas/entities/parcela.entity';
import { Usuario } from '../../usuarios/entities/usuario.entity';

@Injectable()
export class AdminFincaPorParcelaGuard implements CanActivate {
  constructor(
    @InjectRepository(Parcela)
    private readonly parcela_repo: Repository<Parcela>,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest<{
      user?: Usuario;
      params?: { id_parcela?: string };
      query?: { id_parcela?: string };
    }>();
    const usuario = request.user;
    const id_parcela = Number(
      request.params?.id_parcela ?? request.query?.id_parcela,
    );

    if (!usuario || !Number.isFinite(id_parcela) || id_parcela <= 0) {
      throw this.forbidden();
    }

    const parcela = await this.parcela_repo.findOne({
      where: { id_parcela, fecha_baja_parcela: IsNull() },
      relations: ['finca'],
    });
    if (!parcela?.finca || parcela.finca.fecha_baja_finca != null) {
      throw this.forbidden();
    }

    const now = Date.now();
    const es_admin = (usuario.usuario_fincas ?? []).some(
      (uf) =>
        Number(uf.finca?.id_finca) === Number(parcela.finca.id_finca) &&
        uf.rol_finca?.codigo_rol_finca === CODIGO_ADMIN_FINCA &&
        (uf.fecha_fin_rol == null || uf.fecha_fin_rol.getTime() > now),
    );

    if (!es_admin) {
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
