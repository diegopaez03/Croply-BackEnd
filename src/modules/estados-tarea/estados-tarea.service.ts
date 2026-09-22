import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { IsNull, Repository } from 'typeorm';
import { TipoOperacion } from '../../common/enums';
import {
  duplicateValue,
  protectedCatalogItem,
  resourceInUse,
  resourceNotFound,
  unexpectedError,
} from '../../common/exceptions';
import { LogOperacionesService } from '../log-operaciones';
import { Tarea } from '../planes-accion/entities/tarea.entity';
import { Usuario } from '../usuarios/entities/usuario.entity';
import { ActualizarEstadoTareaDto } from './dto/actualizar-estado-tarea.dto';
import { CrearEstadoTareaDto } from './dto/crear-estado-tarea.dto';
import { EstadoTarea } from './entities/estado-tarea.entity';

const ESTADOS_SEMILLA: Array<
  Pick<
    EstadoTarea,
    | 'nombre_estado_tarea'
    | 'protegido'
    | 'es_estado_finalizador'
    | 'cuenta_para_cierre_exitoso'
  >
> = [
  {
    nombre_estado_tarea: 'Planificado',
    protegido: true,
    es_estado_finalizador: false,
    cuenta_para_cierre_exitoso: false,
  },
  {
    nombre_estado_tarea: 'Completado',
    protegido: true,
    es_estado_finalizador: true,
    cuenta_para_cierre_exitoso: true,
  },
  {
    nombre_estado_tarea: 'Cancelada',
    protegido: true,
    es_estado_finalizador: true,
    cuenta_para_cierre_exitoso: false,
  },
];

@Injectable()
export class EstadosTareaService {
  constructor(
    @InjectRepository(EstadoTarea)
    private readonly estado_tarea_repo: Repository<EstadoTarea>,
    @InjectRepository(Tarea)
    private readonly tarea_repo: Repository<Tarea>,
    private readonly log_service: LogOperacionesService,
  ) {}

  async listar() {
    const estados_tarea = await this.estado_tarea_repo.find({
      where: { fecha_baja_estado_tarea: IsNull() },
      order: { id_estado_tarea: 'ASC' },
    });

    return {
      estados_tarea: estados_tarea.map((estado) => this.to_response(estado)),
    };
  }

  async crear(dto: CrearEstadoTareaDto, actor: Usuario) {
    const nombre_estado_tarea = dto.nombre_estado_tarea.trim();
    await this.asegurar_nombre_libre(nombre_estado_tarea);

    const estado = await this.estado_tarea_repo.save(
      this.estado_tarea_repo.create({
        nombre_estado_tarea,
        protegido: false,
        es_estado_finalizador: false,
        cuenta_para_cierre_exitoso: false,
        fecha_baja_estado_tarea: null,
      }),
    );

    await this.log_service.registrar({
      usuario: actor,
      tipo_operacion: TipoOperacion.EXITO,
      descripcion: `Alta de estado de tarea ${estado.nombre_estado_tarea}`,
      recurso: `EstadoTarea:${estado.id_estado_tarea}`,
    });

    return {
      message: 'Estado de tarea creado correctamente',
      ...this.to_response(estado),
    };
  }

  async actualizar(
    id_estado_tarea: number,
    dto: ActualizarEstadoTareaDto,
    actor: Usuario,
  ) {
    const estado = await this.require_activo(id_estado_tarea);
    const nombre_estado_tarea = dto.nombre_estado_tarea.trim();
    await this.asegurar_nombre_libre(nombre_estado_tarea, id_estado_tarea);

    estado.nombre_estado_tarea = nombre_estado_tarea;
    await this.estado_tarea_repo.save(estado);

    await this.log_service.registrar({
      usuario: actor,
      tipo_operacion: TipoOperacion.EXITO,
      descripcion: `Actualización de estado de tarea ${estado.nombre_estado_tarea}`,
      recurso: `EstadoTarea:${estado.id_estado_tarea}`,
    });

    return {
      message: 'Estado de tarea actualizado correctamente',
      ...this.to_response(estado),
    };
  }

  async dar_baja(id_estado_tarea: number, actor: Usuario) {
    const estado = await this.require_activo(id_estado_tarea);
    if (estado.protegido) {
      throw protectedCatalogItem();
    }

    const en_uso = await this.contar_tareas(id_estado_tarea);
    if (en_uso > 0) {
      throw resourceInUse(
        'No es posible dar de baja este estado de tarea porque está en uso.',
      );
    }

    estado.fecha_baja_estado_tarea = new Date();
    await this.estado_tarea_repo.save(estado);

    await this.log_service.registrar({
      usuario: actor,
      tipo_operacion: TipoOperacion.OPERACION_DESTRUCTIVA,
      descripcion: `Baja de estado de tarea ${estado.nombre_estado_tarea}`,
      recurso: `EstadoTarea:${estado.id_estado_tarea}`,
    });

    return {
      message: 'Estado de tarea dado de baja correctamente',
      id_estado_tarea: Number(estado.id_estado_tarea),
    };
  }

  async find_activo_by_id(
    id_estado_tarea: number,
  ): Promise<EstadoTarea | null> {
    return this.estado_tarea_repo.findOne({
      where: { id_estado_tarea, fecha_baja_estado_tarea: IsNull() },
    });
  }

  async estado_inicial(): Promise<EstadoTarea> {
    return this.require_por_flags({
      es_estado_finalizador: false,
      cuenta_para_cierre_exitoso: false,
    });
  }

  async estado_cancelada(): Promise<EstadoTarea> {
    return this.require_por_flags({
      es_estado_finalizador: true,
      cuenta_para_cierre_exitoso: false,
    });
  }

  async ensure_seed(): Promise<void> {
    for (const fila of ESTADOS_SEMILLA) {
      const existente = await this.estado_tarea_repo.findOne({
        where: {
          protegido: true,
          es_estado_finalizador: fila.es_estado_finalizador,
          cuenta_para_cierre_exitoso: fila.cuenta_para_cierre_exitoso,
          fecha_baja_estado_tarea: IsNull(),
        },
      });
      if (existente) {
        continue;
      }
      await this.estado_tarea_repo.save(
        this.estado_tarea_repo.create({
          ...fila,
          fecha_baja_estado_tarea: null,
        }),
      );
    }
  }

  private async require_por_flags(flags: {
    es_estado_finalizador: boolean;
    cuenta_para_cierre_exitoso: boolean;
  }): Promise<EstadoTarea> {
    const estado = await this.estado_tarea_repo.findOne({
      where: {
        protegido: true,
        es_estado_finalizador: flags.es_estado_finalizador,
        cuenta_para_cierre_exitoso: flags.cuenta_para_cierre_exitoso,
        fecha_baja_estado_tarea: IsNull(),
      },
    });
    if (!estado) {
      throw unexpectedError();
    }
    return estado;
  }

  private async contar_tareas(id_estado_tarea: number): Promise<number> {
    return this.tarea_repo.count({
      where: { estado_tarea: { id_estado_tarea } },
    });
  }

  private async require_activo(id_estado_tarea: number): Promise<EstadoTarea> {
    const estado = await this.find_activo_by_id(id_estado_tarea);
    if (!estado) {
      throw resourceNotFound();
    }
    return estado;
  }

  private async asegurar_nombre_libre(
    nombre_estado_tarea: string,
    exclude_id?: number,
  ): Promise<void> {
    const existente = await this.estado_tarea_repo.findOne({
      where: { nombre_estado_tarea, fecha_baja_estado_tarea: IsNull() },
    });
    if (
      existente &&
      (exclude_id == null ||
        Number(existente.id_estado_tarea) !== Number(exclude_id))
    ) {
      throw duplicateValue('nombre_estado_tarea');
    }
  }

  private to_response(estado: EstadoTarea) {
    return {
      id_estado_tarea: Number(estado.id_estado_tarea),
      nombre_estado_tarea: estado.nombre_estado_tarea,
      protegido: estado.protegido,
      es_estado_finalizador: estado.es_estado_finalizador,
      cuenta_para_cierre_exitoso: estado.cuenta_para_cierre_exitoso,
    };
  }
}
