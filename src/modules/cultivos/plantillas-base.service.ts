import { HttpStatus, Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { DataSource, EntityManager, IsNull, Repository } from 'typeorm';
import { build_page_size_pagination } from '../../common/dto';
import { TipoOperacion } from '../../common/enums';
import {
  DomainException,
  duplicateValue,
  emptySchedule,
  resourceNotFound,
  varietyAlreadyAssigned,
} from '../../common/exceptions';
import { LogOperacionesService } from '../log-operaciones';
import { Usuario } from '../usuarios/entities/usuario.entity';
import {
  CrearPlantillaBaseDto,
  HitoPlantillaInputDto,
  PlantillaCultivoInputDto,
} from './dto/crear-plantilla-base.dto';
import { ListarPlantillasBaseQueryDto } from './dto/listar-plantillas-base-query.dto';
import { CultivoBase } from './entities/cultivo-base.entity';
import { HitoPlantilla } from './entities/hito-plantilla.entity';
import { PlantillaBase } from './entities/plantilla-base.entity';
import { PlantillaCultivoVariedad } from './entities/plantilla-cultivo-variedad.entity';
import { TareaPlantilla } from './entities/tarea-plantilla.entity';
import { Variedad } from './entities/variedad.entity';
import {
  es_aplicacion_agroquimico,
  find_tipo_tarea,
} from './tipo-tarea.catalog';

@Injectable()
export class PlantillasBaseService {
  constructor(
    @InjectRepository(PlantillaBase)
    private readonly plantilla_repo: Repository<PlantillaBase>,
    @InjectRepository(PlantillaCultivoVariedad)
    private readonly pcv_repo: Repository<PlantillaCultivoVariedad>,
    @InjectRepository(HitoPlantilla)
    private readonly hito_repo: Repository<HitoPlantilla>,
    @InjectRepository(TareaPlantilla)
    private readonly tarea_repo: Repository<TareaPlantilla>,
    @InjectRepository(CultivoBase)
    private readonly cultivo_repo: Repository<CultivoBase>,
    @InjectRepository(Variedad)
    private readonly variedad_repo: Repository<Variedad>,
    private readonly data_source: DataSource,
    private readonly log_service: LogOperacionesService,
  ) {}

  async listar(query: ListarPlantillasBaseQueryDto) {
    const page = query.page ?? 1;
    const pageSize = query.pageSize ?? 10;
    const [plantillas, totalItems] = await this.plantilla_repo.findAndCount({
      where: { fecha_baja_pb: IsNull() },
      relations: [
        'plantilla_cultivo_variedades',
        'plantilla_cultivo_variedades.cultivo_base',
        'plantilla_cultivo_variedades.variedad',
        'hitos',
        'hitos.tareas',
      ],
      order: { id_plantilla_base: 'DESC' },
      skip: (page - 1) * pageSize,
      take: pageSize,
    });

    return {
      plantillas: plantillas.map((plantilla) => ({
        id_plantilla_base: Number(plantilla.id_plantilla_base),
        nombre_pb: plantilla.nombre_pb,
        cultivos: (plantilla.plantilla_cultivo_variedades ?? []).map((pcv) => ({
          id_pbcv: Number(pcv.id_pbcv),
          id_cultivo_base: Number(pcv.cultivo_base.id_cultivo_base),
          id_variedad:
            pcv.variedad != null ? Number(pcv.variedad.id_variedad) : null,
        })),
        cantidad_tareas: (plantilla.hitos ?? []).reduce(
          (acc, hito) => acc + (hito.tareas?.length ?? 0),
          0,
        ),
      })),
      pagination: build_page_size_pagination(page, pageSize, totalItems),
    };
  }

  async crear(dto: CrearPlantillaBaseDto, actor: Usuario) {
    this.validar_cronograma(dto.hitos);
    await this.asegurar_nombre_libre(dto.nombre_pb.trim());
    await this.validar_cultivos(dto.cultivos);
    await this.validar_asignaciones(dto.cultivos);

    const id = await this.data_source.transaction(async (manager) => {
      const repo = manager.getRepository(PlantillaBase);
      const plantilla = await repo.save(
        repo.create({
          nombre_pb: dto.nombre_pb.trim(),
          fecha_baja_pb: null,
        }),
      );
      await this.persistir_contenido(manager, plantilla, dto);
      return Number(plantilla.id_plantilla_base);
    });

    await this.log_service.registrar({
      usuario: actor,
      tipo_operacion: TipoOperacion.EXITO,
      descripcion: `Alta de plantilla base ${dto.nombre_pb.trim()}`,
      recurso: `PlantillaBase:${id}`,
    });

    return {
      message: 'Plantilla creada correctamente',
      ...(await this.detalle(id)),
    };
  }

  async detalle(id_plantilla_base: number) {
    const plantilla = await this.find_plantilla_completa(id_plantilla_base);
    return this.map_detalle(plantilla);
  }

  async actualizar(
    id_plantilla_base: number,
    dto: CrearPlantillaBaseDto,
    actor: Usuario,
  ) {
    const plantilla = await this.find_plantilla_activa(id_plantilla_base);
    this.validar_cronograma(dto.hitos);
    await this.asegurar_nombre_libre(dto.nombre_pb.trim(), id_plantilla_base);
    await this.validar_cultivos(dto.cultivos);
    await this.validar_asignaciones(dto.cultivos, id_plantilla_base);

    await this.data_source.transaction(async (manager) => {
      const repo = manager.getRepository(PlantillaBase);
      plantilla.nombre_pb = dto.nombre_pb.trim();
      await repo.save(plantilla);
      await this.borrar_contenido(manager, id_plantilla_base);
      await this.persistir_contenido(manager, plantilla, dto);
    });

    await this.log_service.registrar({
      usuario: actor,
      tipo_operacion: TipoOperacion.EXITO,
      descripcion: `Edición de plantilla base ${dto.nombre_pb.trim()}`,
      recurso: `PlantillaBase:${id_plantilla_base}`,
    });

    return {
      message: 'Plantilla actualizada correctamente',
      ...(await this.detalle(id_plantilla_base)),
    };
  }

  async dar_baja(id_plantilla_base: number, actor: Usuario) {
    const plantilla = await this.find_plantilla_activa(id_plantilla_base);
    plantilla.fecha_baja_pb = new Date();
    await this.plantilla_repo.save(plantilla);

    await this.log_service.registrar({
      usuario: actor,
      tipo_operacion: TipoOperacion.OPERACION_DESTRUCTIVA,
      descripcion: `Baja de plantilla base ${plantilla.nombre_pb}`,
      recurso: `PlantillaBase:${id_plantilla_base}`,
    });

    return { message: 'Plantilla eliminada correctamente' };
  }

  async find_activa_por_nombre(nombre_pb: string): Promise<PlantillaBase | null> {
    return this.plantilla_repo.findOne({
      where: { nombre_pb, fecha_baja_pb: IsNull() },
    });
  }

  private validar_cronograma(hitos: HitoPlantillaInputDto[]): void {
    const tiene_tarea = hitos.some((hito) => (hito.tareas?.length ?? 0) > 0);
    if (!tiene_tarea) {
      throw emptySchedule();
    }
    for (const hito of hitos) {
      for (const tarea of hito.tareas ?? []) {
        if (!find_tipo_tarea(tarea.id_tipo_tarea)) {
          throw resourceNotFound('El tipo de tarea indicado no existe.');
        }
        if (
          es_aplicacion_agroquimico(tarea.id_tipo_tarea) &&
          (!tarea.nombre_producto?.trim() || !tarea.dosis_aa?.trim())
        ) {
          throw new DomainException(
            'REQUIRED_FIELD',
            'Campo requerido',
            HttpStatus.BAD_REQUEST,
            !tarea.nombre_producto?.trim() ? 'nombre_producto' : 'dosis_aa',
          );
        }
      }
    }
  }

  private async asegurar_nombre_libre(
    nombre: string,
    exclude_id?: number,
  ): Promise<void> {
    const existente = await this.plantilla_repo.findOne({
      where: { nombre_pb: nombre, fecha_baja_pb: IsNull() },
    });
    if (
      existente &&
      (exclude_id == null ||
        Number(existente.id_plantilla_base) !== Number(exclude_id))
    ) {
      throw duplicateValue('nombre_pb');
    }
  }

  private async validar_cultivos(
    cultivos: PlantillaCultivoInputDto[],
  ): Promise<void> {
    for (const fila of cultivos) {
      const cultivo = await this.cultivo_repo.findOne({
        where: { id_cultivo_base: fila.id_cultivo_base, fecha_baja_cb: IsNull() },
      });
      if (!cultivo) {
        throw resourceNotFound();
      }
      if (fila.id_variedad != null) {
        const variedad = await this.variedad_repo.findOne({
          where: {
            id_variedad: fila.id_variedad,
            fecha_baja: IsNull(),
            cultivo_base: { id_cultivo_base: fila.id_cultivo_base },
          },
        });
        if (!variedad) {
          throw resourceNotFound();
        }
      }
    }
  }

  private async validar_asignaciones(
    cultivos: PlantillaCultivoInputDto[],
    exclude_plantilla_id?: number,
  ): Promise<void> {
    for (const fila of cultivos) {
      if (fila.id_variedad == null) {
        const pcvs = await this.pcv_repo.find({
          where: {
            cultivo_base: { id_cultivo_base: fila.id_cultivo_base },
            variedad: IsNull(),
          },
          relations: ['plantilla_base'],
        });
        const conflicto = pcvs.find(
          (pcv) =>
            pcv.plantilla_base?.fecha_baja_pb == null &&
            (exclude_plantilla_id == null ||
              Number(pcv.plantilla_base.id_plantilla_base) !==
                Number(exclude_plantilla_id)),
        );
        if (conflicto) {
          throw new DomainException(
            'VARIETY_ALREADY_ASSIGNED',
            'Este cultivo ya tiene una plantilla general asignada.',
            HttpStatus.CONFLICT,
          );
        }
        continue;
      }

      const pcvs = await this.pcv_repo.find({
        where: { variedad: { id_variedad: fila.id_variedad } },
        relations: ['plantilla_base', 'cultivo_base'],
      });
      const conflicto = pcvs.find(
        (pcv) =>
          pcv.plantilla_base?.fecha_baja_pb == null &&
          Number(pcv.cultivo_base?.id_cultivo_base) === fila.id_cultivo_base &&
          (exclude_plantilla_id == null ||
            Number(pcv.plantilla_base.id_plantilla_base) !==
              Number(exclude_plantilla_id)),
      );
      if (conflicto) {
        throw varietyAlreadyAssigned(fila.id_variedad);
      }
    }
  }

  private async persistir_contenido(
    manager: EntityManager,
    plantilla: PlantillaBase,
    dto: CrearPlantillaBaseDto,
  ): Promise<void> {
    const pcv_repo = manager.getRepository(PlantillaCultivoVariedad);
    const hito_repo = manager.getRepository(HitoPlantilla);
    const tarea_repo = manager.getRepository(TareaPlantilla);

    for (const fila of dto.cultivos) {
      await pcv_repo.save(
        pcv_repo.create({
          plantilla_base: plantilla,
          cultivo_base: { id_cultivo_base: fila.id_cultivo_base },
          variedad:
            fila.id_variedad != null
              ? { id_variedad: fila.id_variedad }
              : null,
        }),
      );
    }

    for (const hito_dto of dto.hitos) {
      const hito = await hito_repo.save(
        hito_repo.create({
          nombre_hpb: hito_dto.nombre_hpb.trim(),
          orden_hpb: hito_dto.orden_hpb,
          plantilla_base: plantilla,
        }),
      );
      for (const tarea_dto of hito_dto.tareas ?? []) {
        await tarea_repo.save(
          tarea_repo.create({
            dia_relativo_tp: tarea_dto.dia_relativo_tp,
            id_tipo_tarea: tarea_dto.id_tipo_tarea,
            descripcion_tp: tarea_dto.descripcion_tp.trim(),
            nombre_producto: tarea_dto.nombre_producto?.trim() || null,
            dosis_aa: tarea_dto.dosis_aa?.trim() || null,
            hito_plantilla: hito,
          }),
        );
      }
    }
  }

  private async borrar_contenido(
    manager: EntityManager,
    id_plantilla_base: number,
  ): Promise<void> {
    const hito_repo = manager.getRepository(HitoPlantilla);
    const tarea_repo = manager.getRepository(TareaPlantilla);
    const pcv_repo = manager.getRepository(PlantillaCultivoVariedad);

    const hitos = await hito_repo.find({
      where: { plantilla_base: { id_plantilla_base } },
    });
    for (const hito of hitos) {
      await tarea_repo.delete({
        hito_plantilla: { id_hito_plantilla: hito.id_hito_plantilla },
      });
    }
    await hito_repo.delete({ plantilla_base: { id_plantilla_base } });
    await pcv_repo.delete({ plantilla_base: { id_plantilla_base } });
  }

  private async find_plantilla_activa(
    id_plantilla_base: number,
  ): Promise<PlantillaBase> {
    const plantilla = await this.plantilla_repo.findOne({
      where: { id_plantilla_base, fecha_baja_pb: IsNull() },
    });
    if (!plantilla) {
      throw resourceNotFound();
    }
    return plantilla;
  }

  private async find_plantilla_completa(
    id_plantilla_base: number,
  ): Promise<PlantillaBase> {
    const plantilla = await this.plantilla_repo.findOne({
      where: { id_plantilla_base, fecha_baja_pb: IsNull() },
      relations: [
        'plantilla_cultivo_variedades',
        'plantilla_cultivo_variedades.cultivo_base',
        'plantilla_cultivo_variedades.variedad',
        'hitos',
        'hitos.tareas',
      ],
      order: { hitos: { orden_hpb: 'ASC' } },
    });
    if (!plantilla) {
      throw resourceNotFound();
    }
    return plantilla;
  }

  private map_detalle(plantilla: PlantillaBase) {
    const pcvs = plantilla.plantilla_cultivo_variedades ?? [];
    const cultivos_info = this.unique_cultivos_info(pcvs);

    return {
      id_plantilla_base: Number(plantilla.id_plantilla_base),
      nombre_pb: plantilla.nombre_pb,
      cultivos_info,
      cultivos: pcvs.map((pcv) => ({
        id_pbcv: Number(pcv.id_pbcv),
        cultivo_base: this.map_cultivo_resumen(pcv.cultivo_base),
        variedad: pcv.variedad
          ? {
              id_variedad: Number(pcv.variedad.id_variedad),
              nombre_variedad: pcv.variedad.nombre_variedad,
              distancia_plantacion: pcv.variedad.distancia_plantacion,
              observaciones: pcv.variedad.observaciones,
              dias_a_cosecha: pcv.variedad.dias_a_cosecha,
              fecha_alta: pcv.variedad.fecha_alta
                ? pcv.variedad.fecha_alta.toISOString().slice(0, 10)
                : null,
              en_uso: true,
              ciclo_productivo_cb: pcv.cultivo_base.ciclo_productivo_cb,
            }
          : null,
      })),
      hitos: [...(plantilla.hitos ?? [])]
        .sort((a, b) => a.orden_hpb - b.orden_hpb)
        .map((hito) => ({
          id_hito_plantilla: Number(hito.id_hito_plantilla),
          nombre_hpb: hito.nombre_hpb,
          orden_hpb: hito.orden_hpb,
          tareas: (hito.tareas ?? []).map((tarea) => ({
            id_tarea_plantilla: Number(tarea.id_tarea_plantilla),
            dia_relativo_tp: tarea.dia_relativo_tp,
            id_tipo_tarea: tarea.id_tipo_tarea,
            nombre_tipo_tarea:
              find_tipo_tarea(tarea.id_tipo_tarea)?.nombre_tipo_tarea ??
              'Desconocido',
            descripcion_tp: tarea.descripcion_tp,
            nombre_producto: tarea.nombre_producto ?? null,
            dosis_aa: tarea.dosis_aa ?? null,
          })),
        })),
    };
  }

  private unique_cultivos_info(pcvs: PlantillaCultivoVariedad[]) {
    const seen = new Set<number>();
    const result: ReturnType<PlantillasBaseService['map_cultivo_resumen']>[] =
      [];
    for (const pcv of pcvs) {
      const id = Number(pcv.cultivo_base.id_cultivo_base);
      if (seen.has(id)) {
        continue;
      }
      seen.add(id);
      result.push(this.map_cultivo_resumen(pcv.cultivo_base));
    }
    return result;
  }

  private map_cultivo_resumen(cultivo: CultivoBase) {
    return {
      id_cultivo_base: Number(cultivo.id_cultivo_base),
      nombre_cultivo_base: cultivo.nombre_cultivo_base,
      epoca_cultivo: cultivo.epoca_cultivo,
      mes_siembra: cultivo.mes_siembra,
      ciclo_productivo_cb: cultivo.ciclo_productivo_cb,
    };
  }
}
