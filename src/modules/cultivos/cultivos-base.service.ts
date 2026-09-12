import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { IsNull, Repository } from 'typeorm';
import { EpocaCultivo, TipoOperacion } from '../../common/enums';
import {
  duplicateValue,
  resourceInUse,
  resourceNotFound,
} from '../../common/exceptions';
import { LogOperacionesService } from '../log-operaciones';
import { Usuario } from '../usuarios/entities/usuario.entity';
import { CrearCultivoBaseDto } from './dto/crear-cultivo-base.dto';
import { CrearVariedadDto } from './dto/crear-variedad.dto';
import { ListarCultivosBaseQueryDto } from './dto/listar-cultivos-base-query.dto';
import { CultivoBase } from './entities/cultivo-base.entity';
import { PlantillaCultivoVariedad } from './entities/plantilla-cultivo-variedad.entity';
import { Variedad } from './entities/variedad.entity';

@Injectable()
export class CultivosBaseService {
  constructor(
    @InjectRepository(CultivoBase)
    private readonly cultivo_repo: Repository<CultivoBase>,
    @InjectRepository(Variedad)
    private readonly variedad_repo: Repository<Variedad>,
    @InjectRepository(PlantillaCultivoVariedad)
    private readonly pcv_repo: Repository<PlantillaCultivoVariedad>,
    private readonly log_service: LogOperacionesService,
  ) {}

  async find_activo_por_nombre(
    nombre_cultivo_base: string,
  ): Promise<CultivoBase | null> {
    return this.cultivo_repo.findOne({
      where: { nombre_cultivo_base, fecha_baja_cb: IsNull() },
    });
  }

  async listar(query: ListarCultivosBaseQueryDto) {
    const cultivos = await this.cultivo_repo.find({
      where: { fecha_baja_cb: IsNull() },
      relations: ['variedades'],
      order: { nombre_cultivo_base: 'ASC' },
    });

    const filtrados = cultivos.filter((cultivo) =>
      this.coincide_filtros(cultivo, query),
    );

    return {
      cultivos: filtrados.map((cultivo) => this.map_listado(cultivo)),
    };
  }

  async crear(dto: CrearCultivoBaseDto, actor: Usuario) {
    const nombre = dto.nombre_cultivo_base.trim();
    await this.asegurar_nombre_cultivo_libre(nombre);

    const cultivo = await this.cultivo_repo.save(
      this.cultivo_repo.create({
        nombre_cultivo_base: nombre,
        descripcion_cb: dto.descripcion_cb.trim(),
        epoca_cultivo: dto.epoca_cultivo,
        mes_siembra: dto.mes_siembra.trim(),
        ciclo_productivo_cb: dto.ciclo_productivo_cb.trim(),
        forma_siembra: dto.forma_siembra,
        imagen_url: dto.imagen_url ?? null,
        banner_url: dto.banner_url ?? null,
        fecha_baja_cb: null,
      }),
    );

    await this.log_service.registrar({
      usuario: actor,
      tipo_operacion: TipoOperacion.EXITO,
      descripcion: `Alta de cultivo base ${nombre}`,
      recurso: `CultivoBase:${cultivo.id_cultivo_base}`,
    });

    return {
      message: 'Cultivo creado correctamente',
      ...this.map_listado({ ...cultivo, variedades: [] }),
    };
  }

  async detalle(id_cultivo_base: number) {
    const cultivo = await this.find_cultivo_activo(id_cultivo_base, {
      con_variedades: true,
    });
    const pcvs = await this.pcvs_activas_de_cultivo(id_cultivo_base);
    const plantilla_general = pcvs.find((pcv) => pcv.variedad == null);

    const variedades = (cultivo.variedades ?? [])
      .filter((v) => v.fecha_baja == null)
      .map((variedad) => {
        const pcv_especifica = pcvs.find(
          (pcv) =>
            pcv.variedad != null &&
            Number(pcv.variedad.id_variedad) === Number(variedad.id_variedad),
        );
        return {
          id_variedad: Number(variedad.id_variedad),
          nombre_variedad: variedad.nombre_variedad,
          distancia_plantacion: variedad.distancia_plantacion,
          observaciones: variedad.observaciones,
          dias_a_cosecha: variedad.dias_a_cosecha,
          fecha_alta: this.format_fecha_dia(variedad.fecha_alta),
          en_uso: pcv_especifica != null,
          id_plantilla_especifica: pcv_especifica
            ? Number(pcv_especifica.plantilla_base.id_plantilla_base)
            : null,
          imagen_url: variedad.imagen_url ?? null,
        };
      });

    return {
      id_cultivo_base: Number(cultivo.id_cultivo_base),
      nombre_cultivo_base: cultivo.nombre_cultivo_base,
      descripcion_cb: cultivo.descripcion_cb,
      epoca_cultivo: cultivo.epoca_cultivo,
      mes_siembra: cultivo.mes_siembra,
      ciclo_productivo_cb: cultivo.ciclo_productivo_cb,
      forma_siembra: cultivo.forma_siembra,
      id_plantilla_general: plantilla_general
        ? Number(plantilla_general.plantilla_base.id_plantilla_base)
        : null,
      imagen_url: cultivo.imagen_url ?? null,
      banner_url: cultivo.banner_url ?? null,
      variedades,
    };
  }

  async actualizar(
    id_cultivo_base: number,
    dto: CrearCultivoBaseDto,
    actor: Usuario,
  ) {
    const cultivo = await this.find_cultivo_activo(id_cultivo_base, {
      con_variedades: true,
    });
    const nombre = dto.nombre_cultivo_base.trim();
    await this.asegurar_nombre_cultivo_libre(nombre, id_cultivo_base);

    const tiene_variedades = (cultivo.variedades ?? []).some(
      (v) => v.fecha_baja == null,
    );

    cultivo.nombre_cultivo_base = nombre;
    cultivo.descripcion_cb = dto.descripcion_cb.trim();
    cultivo.epoca_cultivo = dto.epoca_cultivo;
    cultivo.mes_siembra = dto.mes_siembra.trim();
    cultivo.forma_siembra = dto.forma_siembra;
    cultivo.imagen_url = dto.imagen_url ?? null;
    cultivo.banner_url = dto.banner_url ?? null;
    if (!tiene_variedades) {
      cultivo.ciclo_productivo_cb = dto.ciclo_productivo_cb.trim();
    }

    const variedades_para_respuesta = cultivo.variedades ?? [];
    await this.guardar_cultivo(cultivo);

    await this.log_service.registrar({
      usuario: actor,
      tipo_operacion: TipoOperacion.EXITO,
      descripcion: `Edición de cultivo base ${nombre}`,
      recurso: `CultivoBase:${id_cultivo_base}`,
    });

    return {
      message: 'Cultivo actualizado correctamente',
      ...this.map_listado({ ...cultivo, variedades: variedades_para_respuesta }),
    };
  }

  async dar_baja(id_cultivo_base: number, actor: Usuario) {
    const cultivo = await this.find_cultivo_activo(id_cultivo_base);
    if (await this.cultivo_en_uso(id_cultivo_base)) {
      throw resourceInUse(
        'Este cultivo no se puede eliminar porque está en uso.',
      );
    }

    cultivo.fecha_baja_cb = new Date();
    await this.guardar_cultivo(cultivo);

    await this.log_service.registrar({
      usuario: actor,
      tipo_operacion: TipoOperacion.OPERACION_DESTRUCTIVA,
      descripcion: `Baja de cultivo base ${cultivo.nombre_cultivo_base}`,
      recurso: `CultivoBase:${id_cultivo_base}`,
    });

    return { message: 'Cultivo eliminado correctamente' };
  }

  async agregar_variedad(
    id_cultivo_base: number,
    dto: CrearVariedadDto,
    actor: Usuario,
  ) {
    const cultivo = await this.find_cultivo_activo(id_cultivo_base);
    const nombre = dto.nombre_variedad.trim();
    await this.asegurar_nombre_variedad_libre(id_cultivo_base, nombre);

    const variedad = await this.variedad_repo.save(
      this.variedad_repo.create({
        nombre_variedad: nombre,
        distancia_plantacion: dto.distancia_plantacion.trim(),
        observaciones: dto.observaciones?.trim() || null,
        dias_a_cosecha: dto.dias_a_cosecha,
        imagen_url: dto.imagen_url ?? null,
        fecha_baja: null,
        cultivo_base: { id_cultivo_base: Number(id_cultivo_base) },
      }),
    );

    const ciclo = await this.recalcular_ciclo(cultivo);

    await this.log_service.registrar({
      usuario: actor,
      tipo_operacion: TipoOperacion.EXITO,
      descripcion: `Alta de variedad ${nombre}`,
      recurso: `Variedad:${variedad.id_variedad}`,
    });

    return {
      message: 'Variedad agregada correctamente',
      ...this.map_variedad_mutacion(variedad, false, ciclo),
    };
  }

  async actualizar_variedad(
    id_cultivo_base: number,
    id_variedad: number,
    dto: CrearVariedadDto,
    actor: Usuario,
  ) {
    const cultivo = await this.find_cultivo_activo(id_cultivo_base);
    const variedad = await this.find_variedad_activa(
      id_cultivo_base,
      id_variedad,
    );
    const nombre = dto.nombre_variedad.trim();
    await this.asegurar_nombre_variedad_libre(
      id_cultivo_base,
      nombre,
      id_variedad,
    );

    variedad.nombre_variedad = nombre;
    variedad.distancia_plantacion = dto.distancia_plantacion.trim();
    variedad.observaciones = dto.observaciones?.trim() || null;
    variedad.dias_a_cosecha = dto.dias_a_cosecha;
    variedad.imagen_url = dto.imagen_url ?? null;
    await this.variedad_repo.save(variedad);

    const ciclo = await this.recalcular_ciclo(cultivo);
    const en_uso = await this.variedad_en_uso(id_variedad);

    await this.log_service.registrar({
      usuario: actor,
      tipo_operacion: TipoOperacion.EXITO,
      descripcion: `Edición de variedad ${nombre}`,
      recurso: `Variedad:${id_variedad}`,
    });

    return {
      message: 'Variedad actualizada correctamente',
      ...this.map_variedad_mutacion(variedad, en_uso, ciclo),
    };
  }

  async dar_baja_variedad(
    id_cultivo_base: number,
    id_variedad: number,
    actor: Usuario,
  ) {
    const cultivo = await this.find_cultivo_activo(id_cultivo_base);
    const variedad = await this.find_variedad_activa(
      id_cultivo_base,
      id_variedad,
    );

    if (await this.variedad_en_uso(id_variedad)) {
      throw resourceInUse(
        'Esta variedad no se puede eliminar porque está en uso.',
      );
    }

    variedad.fecha_baja = new Date();
    await this.variedad_repo.save(variedad);

    const ciclo = await this.recalcular_ciclo(cultivo);

    await this.log_service.registrar({
      usuario: actor,
      tipo_operacion: TipoOperacion.OPERACION_DESTRUCTIVA,
      descripcion: `Baja de variedad ${variedad.nombre_variedad}`,
      recurso: `Variedad:${id_variedad}`,
    });

    return {
      message: 'Variedad eliminada correctamente',
      ciclo_productivo_cb: ciclo,
    };
  }

  private coincide_filtros(
    cultivo: CultivoBase,
    query: ListarCultivosBaseQueryDto,
  ): boolean {
    if (query.search?.trim()) {
      const needle = query.search.trim().toLowerCase();
      if (!cultivo.nombre_cultivo_base.toLowerCase().includes(needle)) {
        return false;
      }
    }
    if (
      query.epoca_cultivo &&
      query.epoca_cultivo !== EpocaCultivo.TODO_EL_ANIO &&
      cultivo.epoca_cultivo !== query.epoca_cultivo
    ) {
      return false;
    }
    if (
      query.forma_siembra &&
      cultivo.forma_siembra !== query.forma_siembra
    ) {
      return false;
    }
    return true;
  }

  private map_listado(cultivo: CultivoBase) {
    const cantidad_variedades = (cultivo.variedades ?? []).filter(
      (v) => v.fecha_baja == null,
    ).length;
    return {
      id_cultivo_base: Number(cultivo.id_cultivo_base),
      nombre_cultivo_base: cultivo.nombre_cultivo_base,
      descripcion_cb: cultivo.descripcion_cb,
      epoca_cultivo: cultivo.epoca_cultivo,
      mes_siembra: cultivo.mes_siembra,
      ciclo_productivo_cb: cultivo.ciclo_productivo_cb,
      forma_siembra: cultivo.forma_siembra,
      cantidad_variedades,
      imagen_url: cultivo.imagen_url ?? null,
      banner_url: cultivo.banner_url ?? null,
    };
  }

  private map_variedad_mutacion(
    variedad: Variedad,
    en_uso: boolean,
    ciclo_productivo_cb: string,
  ) {
    return {
      id_variedad: Number(variedad.id_variedad),
      nombre_variedad: variedad.nombre_variedad,
      distancia_plantacion: variedad.distancia_plantacion,
      observaciones: variedad.observaciones,
      dias_a_cosecha: variedad.dias_a_cosecha,
      fecha_alta: this.format_fecha_dia(variedad.fecha_alta),
      en_uso,
      ciclo_productivo_cb,
      imagen_url: variedad.imagen_url ?? null,
    };
  }

  private async find_cultivo_activo(
    id_cultivo_base: number,
    options?: { con_variedades?: boolean },
  ): Promise<CultivoBase> {
    const cultivo = await this.cultivo_repo.findOne({
      where: { id_cultivo_base, fecha_baja_cb: IsNull() },
      relations: options?.con_variedades ? ['variedades'] : [],
    });
    if (!cultivo) {
      throw resourceNotFound();
    }
    return cultivo;
  }

  /**
   * TypeORM trata `variedades: []` como “desvincular hijos” y pone
   * `id_cultivo_base = NULL`. Nunca hay que guardar el padre con esa colección cargada.
   */
  private async guardar_cultivo(cultivo: CultivoBase): Promise<CultivoBase> {
    delete (cultivo as { variedades?: Variedad[] }).variedades;
    delete (cultivo as { plantilla_cultivo_variedades?: PlantillaCultivoVariedad[] })
      .plantilla_cultivo_variedades;
    return this.cultivo_repo.save(cultivo);
  }

  private async find_variedad_activa(
    id_cultivo_base: number,
    id_variedad: number,
  ): Promise<Variedad> {
    const variedad = await this.variedad_repo.findOne({
      where: {
        id_variedad,
        fecha_baja: IsNull(),
        cultivo_base: { id_cultivo_base, fecha_baja_cb: IsNull() },
      },
      relations: ['cultivo_base'],
    });
    if (!variedad) {
      throw resourceNotFound();
    }
    return variedad;
  }

  private async asegurar_nombre_cultivo_libre(
    nombre: string,
    exclude_id?: number,
  ): Promise<void> {
    const existente = await this.cultivo_repo.findOne({
      where: { nombre_cultivo_base: nombre, fecha_baja_cb: IsNull() },
    });
    if (
      existente &&
      (exclude_id == null ||
        Number(existente.id_cultivo_base) !== Number(exclude_id))
    ) {
      throw duplicateValue('nombre_cultivo_base');
    }
  }

  private async asegurar_nombre_variedad_libre(
    id_cultivo_base: number,
    nombre: string,
    exclude_id?: number,
  ): Promise<void> {
    const existente = await this.variedad_repo.findOne({
      where: {
        nombre_variedad: nombre,
        fecha_baja: IsNull(),
        cultivo_base: { id_cultivo_base },
      },
    });
    if (
      existente &&
      (exclude_id == null ||
        Number(existente.id_variedad) !== Number(exclude_id))
    ) {
      throw duplicateValue('nombre_variedad');
    }
  }

  private async pcvs_activas_de_cultivo(
    id_cultivo_base: number,
  ): Promise<PlantillaCultivoVariedad[]> {
    const pcvs = await this.pcv_repo.find({
      where: { cultivo_base: { id_cultivo_base } },
      relations: ['plantilla_base', 'variedad'],
    });
    return pcvs.filter((pcv) => pcv.plantilla_base?.fecha_baja_pb == null);
  }

  private async cultivo_en_uso(id_cultivo_base: number): Promise<boolean> {
    const pcvs = await this.pcvs_activas_de_cultivo(id_cultivo_base);
    return pcvs.length > 0;
  }

  private async variedad_en_uso(id_variedad: number): Promise<boolean> {
    const pcvs = await this.pcv_repo.find({
      where: { variedad: { id_variedad } },
      relations: ['plantilla_base'],
    });
    return pcvs.some((pcv) => pcv.plantilla_base?.fecha_baja_pb == null);
  }

  private async recalcular_ciclo(cultivo: CultivoBase): Promise<string> {
    const variedades = await this.variedad_repo.find({
      where: {
        cultivo_base: { id_cultivo_base: cultivo.id_cultivo_base },
        fecha_baja: IsNull(),
      },
    });
    const ciclo = this.ciclo_desde_dias(
      variedades.map((v) => v.dias_a_cosecha),
    );
    if (ciclo) {
      cultivo.ciclo_productivo_cb = ciclo;
      await this.guardar_cultivo(cultivo);
    }
    return cultivo.ciclo_productivo_cb;
  }

  private ciclo_desde_dias(dias: number[]): string | null {
    if (dias.length === 0) {
      return null;
    }
    const min = Math.min(...dias);
    const max = Math.max(...dias);
    if (min === max) {
      return `${min} días`;
    }
    return `${min}-${max} días`;
  }

  private format_fecha_dia(fecha: Date): string {
    return fecha.toISOString().slice(0, 10);
  }
}
