import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { DataSource, IsNull, Repository, SelectQueryBuilder } from 'typeorm';
import { EstadoPlanAccion, TipoOperacion } from '../../common/enums';
import {
  agrochemicalTaskTypeUnavailable,
  emptyExportResult,
  invalidDateRange,
  linkedTaskDeleted,
  parcelWithoutActionPlan,
  requiredField,
  resourceNotFound,
} from '../../common/exceptions';
import { Finca } from '../fincas/entities/finca.entity';
import { UsuarioFinca } from '../fincas/entities/usuario-finca.entity';
import { LogOperacionesService } from '../log-operaciones';
import { Parcela } from '../parcelas/entities/parcela.entity';
import { PlanesAccionService } from '../planes-accion';
import { AplicacionAgroquimico } from '../planes-accion/entities/aplicacion-agroquimico.entity';
import { Hito } from '../planes-accion/entities/hito.entity';
import { PlanAccion } from '../planes-accion/entities/plan-accion.entity';
import { Tarea } from '../planes-accion/entities/tarea.entity';
import { TiposTareaService } from '../tipos-tarea';
import { Usuario } from '../usuarios/entities/usuario.entity';
import { armar_pdf_historial } from './agroquimicos.pdf';
import {
  ActualizarAplicacionAgroquimicoDto,
  CrearAplicacionAgroquimicoDto,
  ExportarAplicacionesQueryDto,
  ListarAplicacionesQueryDto,
} from './dto/agroquimicos.dto';

const MENSAJE_SIN_PLAN =
  'La parcela seleccionada no tiene un plan de acción activo con hitos.';

interface FiltrosAplicacion {
  id_parcela?: number;
  id_responsable?: number;
  fecha_desde?: string;
  fecha_hasta?: string;
}

@Injectable()
export class AgroquimicosService {
  constructor(
    @InjectRepository(AplicacionAgroquimico)
    private readonly agro_repo: Repository<AplicacionAgroquimico>,
    @InjectRepository(Parcela)
    private readonly parcela_repo: Repository<Parcela>,
    @InjectRepository(PlanAccion)
    private readonly plan_repo: Repository<PlanAccion>,
    @InjectRepository(Hito)
    private readonly hito_repo: Repository<Hito>,
    @InjectRepository(UsuarioFinca)
    private readonly usuario_finca_repo: Repository<UsuarioFinca>,
    @InjectRepository(Finca)
    private readonly finca_repo: Repository<Finca>,
    private readonly planes_service: PlanesAccionService,
    private readonly tipos_tarea_service: TiposTareaService,
    private readonly log_service: LogOperacionesService,
    private readonly data_source: DataSource,
  ) {}

  async registrar(
    id_finca: number,
    dto: CrearAplicacionAgroquimicoDto,
    actor: Usuario,
  ) {
    const parcela = await this.require_parcela(id_finca, dto.id_parcela, true);
    await this.require_plan_activo_con_hitos(parcela.id_parcela);
    const hito = await this.require_hito_del_plan_activo(
      parcela.id_parcela,
      dto.id_hito_real,
    );
    const responsable = await this.require_responsable(
      id_finca,
      dto.id_responsable,
      true,
    );
    const tipo = await this.tipos_tarea_service.tipo_agroquimico_activo();
    if (!tipo) {
      throw agrochemicalTaskTypeUnavailable();
    }

    const nombre = texto_requerido(dto.nombre_producto_aa, 'nombre_producto_aa');
    const dosis = texto_requerido(dto.dosis_aa, 'dosis_aa');
    const observaciones = texto_opcional(dto.observaciones);
    const fecha = new Date(dto.fecha_hora_aplicacion_aa);

    const aplicacion = await this.data_source.transaction(async (manager) => {
      const tarea = await this.planes_service.crear_tarea_ya_finalizada(
        {
          id_hito: Number(hito.id_hito),
          nombre_producto_aa: nombre,
          dosis_aa: dosis,
          fecha_hora_aplicacion_aa: fecha,
          responsable,
        },
        manager,
      );
      const repo = manager.getRepository(AplicacionAgroquimico);
      return repo.save(
        repo.create({
          nombre_producto_aa: nombre,
          dosis_aa: dosis,
          fecha_hora_aplicacion_aa: fecha,
          observaciones,
          parcela,
          responsable,
          tarea,
        }),
      );
    });

    await this.log_service.registrar({
      usuario: actor,
      tipo_operacion: TipoOperacion.EXITO,
      descripcion: `Alta de aplicación de agroquímico ${nombre}`,
      recurso: `AplicacionAgroquimico:${aplicacion.id_aplicacion_agroquimico}`,
    });

    return this.to_detalle(
      aplicacion,
      'Aplicación registrada correctamente',
      false,
    );
  }

  async actualizar(
    id_finca: number,
    id_aplicacion: number,
    dto: ActualizarAplicacionAgroquimicoDto,
    actor: Usuario,
  ) {
    const aplicacion = await this.require_de_finca(id_finca, id_aplicacion);
    if (!aplicacion.tarea) {
      throw linkedTaskDeleted();
    }
    const responsable = await this.require_responsable(
      id_finca,
      dto.id_responsable,
      true,
    );

    const nombre = texto_requerido(dto.nombre_producto_aa, 'nombre_producto_aa');
    const dosis = texto_requerido(dto.dosis_aa, 'dosis_aa');
    const observaciones =
      dto.observaciones === undefined
        ? aplicacion.observaciones
        : texto_opcional(dto.observaciones);
    const fecha = new Date(dto.fecha_hora_aplicacion_aa);

    aplicacion.nombre_producto_aa = nombre;
    aplicacion.dosis_aa = dosis;
    aplicacion.fecha_hora_aplicacion_aa = fecha;
    aplicacion.observaciones = observaciones;
    aplicacion.responsable = responsable;

    const tarea = aplicacion.tarea;
    tarea.nombre_tarea = nombre;
    tarea.descripcion_tarea = nombre;
    tarea.fecha_ejecucion_tarea = fecha;
    tarea.nombre_producto_aa = nombre;
    tarea.dosis_aa = dosis;
    tarea.fecha_hora_aplicacion_aa = fecha;
    tarea.responsable = responsable;

    const actualizada = await this.data_source.transaction(async (manager) => {
      await manager.getRepository(Tarea).save(tarea);
      return manager.getRepository(AplicacionAgroquimico).save(aplicacion);
    });

    await this.log_service.registrar({
      usuario: actor,
      tipo_operacion: TipoOperacion.EXITO,
      descripcion: `Actualización de aplicación de agroquímico ${nombre}`,
      recurso: `AplicacionAgroquimico:${actualizada.id_aplicacion_agroquimico}`,
    });

    return this.to_detalle(
      actualizada,
      'Aplicación actualizada correctamente',
      true,
    );
  }

  async listar(id_finca: number, query: ListarAplicacionesQueryDto) {
    this.validar_rango(query.fecha_desde, query.fecha_hasta);
    if (query.id_parcela != null) {
      await this.require_parcela(id_finca, query.id_parcela, false);
    }
    if (query.id_responsable != null) {
      await this.require_responsable(id_finca, query.id_responsable, false);
    }

    const page = query.page ?? 1;
    const pageSize = query.pageSize ?? 10;
    const [filas, total] = await this.consultar(id_finca, query)
      .skip((page - 1) * pageSize)
      .take(pageSize)
      .getManyAndCount();

    return {
      aplicaciones: filas.map((fila) => this.to_item(fila)),
      total,
      page,
      pageSize,
    };
  }

  async exportar(id_finca: number, query: ExportarAplicacionesQueryDto) {
    this.validar_rango(query.fecha_desde, query.fecha_hasta);
    const parcela =
      query.id_parcela != null
        ? await this.require_parcela(id_finca, query.id_parcela, false)
        : null;
    const finca = await this.finca_repo.findOne({ where: { id_finca } });
    if (!finca) {
      throw resourceNotFound();
    }

    const filas = await this.consultar(id_finca, query).getMany();
    if (filas.length === 0) {
      throw emptyExportResult();
    }

    const generado = new Date();
    const buffer = await armar_pdf_historial({
      id_reporte: `AQ-${id_finca}-${generado.getTime()}`,
      fecha_generacion: generado.toISOString(),
      rango: texto_rango(query.fecha_desde, query.fecha_hasta),
      nombre_parcela: parcela?.nombre_parcela ?? null,
      filas: filas.map((fila) => ({
        fecha: fecha_tabla(fila.fecha_hora_aplicacion_aa),
        producto: fila.nombre_producto_aa ?? '',
        dosis: fila.dosis_aa ?? '',
        parcela: fila.parcela?.nombre_parcela ?? '',
      })),
    });

    return {
      buffer,
      filename: `agroquimicos_${slug_nombre(finca.nombre_finca)}_${generado.toISOString().slice(0, 10)}.pdf`,
    };
  }

  private consultar(
    id_finca: number,
    filtros: FiltrosAplicacion,
  ): SelectQueryBuilder<AplicacionAgroquimico> {
    const qb = this.agro_repo
      .createQueryBuilder('aplicacion')
      .innerJoinAndSelect('aplicacion.parcela', 'parcela')
      .innerJoin('parcela.finca', 'finca')
      .leftJoinAndSelect('aplicacion.responsable', 'responsable')
      .leftJoinAndSelect('responsable.usuario', 'usuario')
      .where('finca.id_finca = :id_finca', { id_finca });

    if (filtros.id_parcela != null) {
      qb.andWhere('parcela.id_parcela = :id_parcela', {
        id_parcela: filtros.id_parcela,
      });
    }
    if (filtros.id_responsable != null) {
      qb.andWhere('responsable.id_usuario_finca = :id_responsable', {
        id_responsable: filtros.id_responsable,
      });
    }
    if (filtros.fecha_desde) {
      qb.andWhere('aplicacion.fecha_hora_aplicacion_aa >= :fecha_desde', {
        fecha_desde: inicio_dia_utc(filtros.fecha_desde),
      });
    }
    if (filtros.fecha_hasta) {
      qb.andWhere('aplicacion.fecha_hora_aplicacion_aa < :fecha_hasta', {
        fecha_hasta: dia_siguiente_utc(filtros.fecha_hasta),
      });
    }

    return qb
      .orderBy('aplicacion.fecha_hora_aplicacion_aa', 'DESC', 'NULLS LAST')
      .addOrderBy('aplicacion.id_aplicacion_agroquimico', 'DESC');
  }

  private validar_rango(fecha_desde?: string, fecha_hasta?: string) {
    if (
      fecha_desde &&
      fecha_hasta &&
      fecha_hasta.slice(0, 10) < fecha_desde.slice(0, 10)
    ) {
      throw invalidDateRange();
    }
  }

  private async require_parcela(
    id_finca: number,
    id_parcela: number,
    solo_activa: boolean,
  ): Promise<Parcela> {
    const parcela = await this.parcela_repo.findOne({
      where: {
        id_parcela,
        finca: { id_finca },
        ...(solo_activa ? { fecha_baja_parcela: IsNull() } : {}),
      },
      relations: ['finca'],
    });
    if (!parcela) {
      throw resourceNotFound();
    }
    return parcela;
  }

  private async require_plan_activo_con_hitos(id_parcela: number): Promise<void> {
    const planes = await this.plan_repo.find({
      where: {
        estado: EstadoPlanAccion.ACTIVO,
        parcela: { id_parcela },
      },
      relations: ['hitos'],
    });
    const con_hitos = planes.some((plan) => (plan.hitos ?? []).length > 0);
    if (!con_hitos) {
      throw parcelWithoutActionPlan(MENSAJE_SIN_PLAN);
    }
  }

  private async require_hito_del_plan_activo(
    id_parcela: number,
    id_hito: number,
  ): Promise<Hito> {
    const hito = await this.hito_repo.findOne({
      where: {
        id_hito,
        plan_accion: {
          estado: EstadoPlanAccion.ACTIVO,
          parcela: { id_parcela },
        },
      },
    });
    if (!hito) {
      throw resourceNotFound();
    }
    return hito;
  }

  private async require_responsable(
    id_finca: number,
    id_responsable: number,
    solo_vigente: boolean,
  ): Promise<UsuarioFinca> {
    const membresia = await this.usuario_finca_repo.findOne({
      where: { id_usuario_finca: id_responsable },
      relations: ['finca', 'usuario'],
    });
    const ahora = Date.now();
    const de_la_finca = Number(membresia?.finca?.id_finca) === Number(id_finca);
    const vigente =
      membresia?.fecha_fin_rol == null ||
      membresia.fecha_fin_rol.getTime() > ahora;
    if (!membresia || !de_la_finca || (solo_vigente && !vigente)) {
      throw resourceNotFound();
    }
    return membresia;
  }

  private async require_de_finca(
    id_finca: number,
    id_aplicacion: number,
  ): Promise<AplicacionAgroquimico> {
    const aplicacion = await this.agro_repo.findOne({
      where: {
        id_aplicacion_agroquimico: id_aplicacion,
        parcela: { finca: { id_finca } },
      },
      relations: [
        'parcela',
        'responsable',
        'responsable.usuario',
        'tarea',
        'tarea.hito',
      ],
    });
    if (!aplicacion) {
      throw resourceNotFound();
    }
    return aplicacion;
  }

  private to_item(aplicacion: AplicacionAgroquimico) {
    return {
      id_aplicacion: Number(aplicacion.id_aplicacion_agroquimico),
      fecha_hora_aplicacion_aa: to_iso(aplicacion.fecha_hora_aplicacion_aa),
      nombre_producto_aa: aplicacion.nombre_producto_aa,
      dosis_aa: aplicacion.dosis_aa,
      id_parcela: Number(aplicacion.parcela?.id_parcela),
      nombre_parcela: aplicacion.parcela?.nombre_parcela ?? '',
      id_responsable: aplicacion.responsable
        ? Number(aplicacion.responsable.id_usuario_finca)
        : null,
      nombre_responsable: nombre_responsable(aplicacion.responsable),
    };
  }

  private to_detalle(
    aplicacion: AplicacionAgroquimico,
    message: string,
    incluir_modificacion: boolean,
  ): DetalleAplicacion {
    const hito = aplicacion.tarea?.hito;
    const detalle: DetalleAplicacion = {
      message,
      ...this.to_item(aplicacion),
      observaciones: aplicacion.observaciones,
      id_hito_real: hito ? Number(hito.id_hito) : null,
      nombre_hito: hito?.nombre_hito ?? null,
      id_tarea: aplicacion.tarea ? Number(aplicacion.tarea.id_tarea) : null,
      fecha_creacion: to_iso(aplicacion.fecha_creacion),
    };
    if (incluir_modificacion) {
      detalle.fecha_modificacion = to_iso(aplicacion.fecha_modificacion);
    }
    return detalle;
  }
}

export interface DetalleAplicacion {
  message: string;
  id_aplicacion: number;
  fecha_hora_aplicacion_aa: string | null;
  nombre_producto_aa: string | null;
  dosis_aa: string | null;
  id_parcela: number;
  nombre_parcela: string;
  id_responsable: number | null;
  nombre_responsable: string | null;
  observaciones: string | null;
  id_hito_real: number | null;
  nombre_hito: string | null;
  id_tarea: number | null;
  fecha_creacion: string | null;
  fecha_modificacion?: string | null;
}

function texto_requerido(value: string, field: string): string {
  const texto = value?.trim();
  if (!texto) {
    throw requiredField(field);
  }
  return texto;
}

function texto_opcional(value?: string | null): string | null {
  const texto = value?.trim();
  return texto ? texto : null;
}

function nombre_responsable(responsable: UsuarioFinca | null): string | null {
  const usuario = responsable?.usuario;
  if (!usuario) {
    return null;
  }
  return `${usuario.nombre} ${usuario.apellido}`.trim();
}

function to_iso(value: Date | string | null | undefined): string | null {
  if (value == null) {
    return null;
  }
  const date = value instanceof Date ? value : new Date(value);
  return Number.isNaN(date.getTime()) ? null : date.toISOString();
}

function inicio_dia_utc(fecha: string): Date {
  return new Date(`${fecha.slice(0, 10)}T00:00:00.000Z`);
}

function dia_siguiente_utc(fecha: string): Date {
  const inicio = inicio_dia_utc(fecha);
  return new Date(inicio.getTime() + 24 * 60 * 60 * 1000);
}

function texto_rango(fecha_desde?: string, fecha_hasta?: string): string {
  const desde = fecha_desde?.slice(0, 10);
  const hasta = fecha_hasta?.slice(0, 10);
  if (desde && hasta) {
    return `${desde} a ${hasta}`;
  }
  if (desde) {
    return `Desde ${desde}`;
  }
  if (hasta) {
    return `Hasta ${hasta}`;
  }
  return 'Todas las fechas';
}

function fecha_tabla(value: Date | null): string {
  const iso = to_iso(value);
  if (!iso) {
    return '';
  }
  return `${iso.slice(0, 10)} ${iso.slice(11, 16)}`;
}

function slug_nombre(nombre: string): string {
  const slug = nombre
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
  return slug || 'finca';
}
