import { HttpStatus, Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { IsNull, Repository } from 'typeorm';
import { EstadoPlanAccion } from '../../common/enums';
import { DomainException, resourceNotFound } from '../../common/exceptions';
import { CultivosBaseService } from '../cultivos/cultivos-base.service';
import { PlantillasBaseService } from '../cultivos/plantillas-base.service';
import { CultivoBase } from '../cultivos/entities/cultivo-base.entity';
import { HitoPlantilla } from '../cultivos/entities/hito-plantilla.entity';
import { PlantillaBase } from '../cultivos/entities/plantilla-base.entity';
import { PlantillaCultivoVariedad } from '../cultivos/entities/plantilla-cultivo-variedad.entity';
import { Variedad } from '../cultivos/entities/variedad.entity';
import { Parcela } from '../parcelas/entities/parcela.entity';
import { CrearPlanAccionDto } from './dto/planes-accion.dto';
import { Hito } from './entities/hito.entity';
import { PlanAccion } from './entities/plan-accion.entity';
import { Tarea } from './entities/tarea.entity';

@Injectable()
export class PlanesAccionService {
  constructor(
    @InjectRepository(PlanAccion)
    private readonly plan_repo: Repository<PlanAccion>,
    @InjectRepository(Hito)
    private readonly hito_repo: Repository<Hito>,
    @InjectRepository(Tarea)
    private readonly tarea_repo: Repository<Tarea>,
    @InjectRepository(Parcela)
    private readonly parcela_repo: Repository<Parcela>,
    @InjectRepository(CultivoBase)
    private readonly cultivo_repo: Repository<CultivoBase>,
    @InjectRepository(Variedad)
    private readonly variedad_repo: Repository<Variedad>,
    @InjectRepository(PlantillaCultivoVariedad)
    private readonly pcv_repo: Repository<PlantillaCultivoVariedad>,
    private readonly cultivos_service: CultivosBaseService,
    private readonly plantillas_service: PlantillasBaseService,
  ) {}

  async plan_preview(id_cultivo_base: number, id_parcela: number) {
    const cultivo = await this.cultivos_service.detalle(id_cultivo_base);
    const parcela = await this.require_parcela(id_parcela);
    const plantillas = await this.find_plantillas_del_cultivo(id_cultivo_base);
    const superficie_disponible_parcela = await this.superficie_disponible(parcela);

    const grouped = new Map<number, {
      plantilla: PlantillaBase;
      variedades: Array<{ id_variedad: number; nombre_variedad: string }>;
    }>();
    for (const pcv of plantillas) {
      const id_plantilla = Number(pcv.plantilla_base.id_plantilla_base);
      const actual = grouped.get(id_plantilla) ?? {
        plantilla: pcv.plantilla_base,
        variedades: [],
      };
      if (pcv.variedad) {
        actual.variedades.push({
          id_variedad: Number(pcv.variedad.id_variedad),
          nombre_variedad: pcv.variedad.nombre_variedad,
        });
      } else {
        actual.variedades = cultivo.variedades.map((variedad) => ({
          id_variedad: variedad.id_variedad,
          nombre_variedad: variedad.nombre_variedad,
        }));
      }
      grouped.set(id_plantilla, actual);
    }

    const result = [];
    for (const item of grouped.values()) {
      const detalle = await this.plantillas_service.detalle(
        Number(item.plantilla.id_plantilla_base),
      );
      result.push({
        id_plantilla_base: Number(item.plantilla.id_plantilla_base),
        variedades: item.variedades,
        hitos: detalle.hitos.map((hito) => ({
          nombre_hpb: hito.nombre_hpb,
          orden_hpb: hito.orden_hpb,
          tareas: hito.tareas.map((tarea) => ({
            descripcion_tp: tarea.descripcion_tp,
            dia_relativo_tp: tarea.dia_relativo_tp,
          })),
        })),
      });
    }

    return { superficie_disponible_parcela, plantillas: result };
  }

  async crear(id_parcela: number, dto: CrearPlanAccionDto) {
    const parcela = await this.require_parcela(id_parcela);
    const cultivo = await this.cultivo_repo.findOne({
      where: { id_cultivo_base: dto.id_cultivo_base, fecha_baja_cb: IsNull() },
    });
    if (!cultivo) {
      throw resourceNotFound();
    }

    const superficie_disponible_parcela = await this.superficie_disponible(parcela);
    const total_solicitado = dto.asignaciones.reduce(
      (total, asignacion) => total + asignacion.superficie_asignada,
      0,
    );
    if (
      dto.asignaciones.some(
        (asignacion) => asignacion.superficie_asignada > superficie_disponible_parcela,
      ) ||
      total_solicitado > superficie_disponible_parcela
    ) {
      throw new DomainException(
        'INSUFFICIENT_AREA',
        'La superficie ingresada excede la superficie disponible en la parcela.',
        HttpStatus.BAD_REQUEST,
        'superficie_asignada',
      );
    }

    const ids_plan_accion: number[] = [];
    for (const asignacion of dto.asignaciones) {
      const variedad = await this.variedad_repo.findOne({
        where: {
          id_variedad: asignacion.id_variedad,
          fecha_baja: IsNull(),
          cultivo_base: { id_cultivo_base: dto.id_cultivo_base },
        },
        relations: ['cultivo_base'],
      });
      if (!variedad) {
        throw resourceNotFound();
      }

      const plantilla = await this.find_plantilla_para_variedad(
        dto.id_cultivo_base,
        asignacion.id_variedad,
      );
      if (!plantilla) {
        throw resourceNotFound();
      }

      const plan = await this.plan_repo.save(
        this.plan_repo.create({
          parcela,
          cultivo_base: cultivo,
          variedad,
          superficie_ocupada_pa: asignacion.superficie_asignada,
          fecha_inicio_pa: asignacion.fecha_inicio,
          fecha_fin_pa: null,
          estado: EstadoPlanAccion.ACTIVO,
        }),
      );
      for (const hito_plantilla of plantilla.hitos ?? []) {
        const hito = await this.hito_repo.save(
          this.hito_repo.create({
            nombre_hito: hito_plantilla.nombre_hpb,
            orden_hito: hito_plantilla.orden_hpb,
            plan_accion: plan,
          }),
        );
        for (const tarea_plantilla of hito_plantilla.tareas ?? []) {
          await this.tarea_repo.save(
            this.tarea_repo.create({
              dia_relativo_tarea: tarea_plantilla.dia_relativo_tp,
              id_tipo_tarea: tarea_plantilla.id_tipo_tarea,
              descripcion_tarea: tarea_plantilla.descripcion_tp,
              nombre_producto: tarea_plantilla.nombre_producto,
              dosis_aa: tarea_plantilla.dosis_aa,
              hito,
            }),
          );
        }
      }
      ids_plan_accion.push(Number(plan.id_plan_accion));
    }

    return {
      message: 'Cultivo y plan de acción asignados correctamente',
      ids_plan_accion,
    };
  }

  async historial_cultivos(id_parcela: number) {
    await this.require_parcela(id_parcela);
    const planes = await this.plan_repo.find({
      where: { parcela: { id_parcela } },
      relations: ['cultivo_base', 'variedad'],
      order: { fecha_inicio_pa: 'DESC' },
    });

    return {
      historial: planes.map((plan) => ({
        id_plan_accion: Number(plan.id_plan_accion),
        nombre_cultivo_base: plan.cultivo_base.nombre_cultivo_base,
        nombre_variedad: plan.variedad.nombre_variedad,
        superficie_ocupada_pa: plan.superficie_ocupada_pa,
        fecha_inicio_pa: plan.fecha_inicio_pa,
        fecha_fin_pa: plan.fecha_fin_pa,
        estado: plan.estado,
      })),
    };
  }

  private async require_parcela(id_parcela: number): Promise<Parcela> {
    const parcela = await this.parcela_repo.findOne({
      where: { id_parcela, fecha_baja_parcela: IsNull() },
      relations: ['finca'],
    });
    if (!parcela) {
      throw resourceNotFound();
    }
    return parcela;
  }

  private async superficie_disponible(parcela: Parcela): Promise<number> {
    const planes = await this.plan_repo.find({
      where: {
        parcela: { id_parcela: parcela.id_parcela },
        estado: EstadoPlanAccion.ACTIVO,
      },
    });
    const ocupada = planes.reduce(
      (total, plan) => total + Number(plan.superficie_ocupada_pa),
      0,
    );
    return Number(parcela.superficie_parcela) - ocupada;
  }

  private async find_plantillas_del_cultivo(
    id_cultivo_base: number,
  ): Promise<PlantillaCultivoVariedad[]> {
    const pcvs = await this.pcv_repo.find({
      where: { cultivo_base: { id_cultivo_base } },
      relations: [
        'plantilla_base',
        'plantilla_base.hitos',
        'plantilla_base.hitos.tareas',
        'variedad',
      ],
    });
    return pcvs.filter((pcv) => pcv.plantilla_base?.fecha_baja_pb == null);
  }

  private async find_plantilla_para_variedad(
    id_cultivo_base: number,
    id_variedad: number,
  ): Promise<PlantillaBase | null> {
    const pcvs = await this.find_plantillas_del_cultivo(id_cultivo_base);
    const especifica = pcvs.find(
      (pcv) => Number(pcv.variedad?.id_variedad) === Number(id_variedad),
    );
    if (especifica) {
      return especifica.plantilla_base;
    }
    return (
      pcvs.find((pcv) => pcv.variedad == null)?.plantilla_base ?? null
    );
  }
}
