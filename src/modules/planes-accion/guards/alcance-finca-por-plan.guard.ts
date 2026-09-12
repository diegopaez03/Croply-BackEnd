import {
  CanActivate,
  ExecutionContext,
  HttpStatus,
  Injectable,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { DomainException } from '../../../common/exceptions';
import { Usuario } from '../../usuarios/entities/usuario.entity';
import { PlanAccion } from '../entities/plan-accion.entity';

@Injectable()
export class AlcanceFincaPorPlanGuard implements CanActivate {
  constructor(
    @InjectRepository(PlanAccion)
    private readonly plan_repo: Repository<PlanAccion>,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest<{
      user?: Usuario;
      params?: { id_plan_accion?: string };
    }>();
    const usuario = request.user;
    const id_plan_accion = Number(request.params?.id_plan_accion);

    if (!usuario || !Number.isFinite(id_plan_accion) || id_plan_accion <= 0) {
      throw this.forbidden();
    }

    const plan = await this.plan_repo.findOne({
      where: { id_plan_accion },
      relations: ['parcela', 'parcela.finca'],
    });
    const finca = plan?.parcela?.finca;
    if (!plan || !finca || finca.fecha_baja_finca != null) {
      throw this.forbidden();
    }

    const now = Date.now();
    const tiene_alcance = (usuario.usuario_fincas ?? []).some(
      (uf) =>
        Number(uf.finca?.id_finca) === Number(finca.id_finca) &&
        (uf.fecha_fin_rol == null || uf.fecha_fin_rol.getTime() > now),
    );

    if (!tiene_alcance) {
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
