import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { IsNull, Repository } from 'typeorm';
import { TipoOperacion } from '../../common/enums';
import {
  duplicateValue,
  protectedCatalogItem,
  resourceInUse,
  resourceNotFound,
} from '../../common/exceptions';
import { TareaPlantilla } from '../cultivos/entities/tarea-plantilla.entity';
import { LogOperacionesService } from '../log-operaciones';
import { Tarea } from '../planes-accion/entities/tarea.entity';
import { Usuario } from '../usuarios/entities/usuario.entity';
import { ActualizarTipoTareaDto } from './dto/actualizar-tipo-tarea.dto';
import { CrearTipoTareaDto } from './dto/crear-tipo-tarea.dto';
import { TipoTarea } from './entities/tipo-tarea.entity';

const NOMBRE_TIPO_AGROQUIMICO = 'Aplicación de agroquímico';

@Injectable()
export class TiposTareaService {
  constructor(
    @InjectRepository(TipoTarea)
    private readonly tipo_tarea_repo: Repository<TipoTarea>,
    @InjectRepository(Tarea)
    private readonly tarea_repo: Repository<Tarea>,
    @InjectRepository(TareaPlantilla)
    private readonly tarea_plantilla_repo: Repository<TareaPlantilla>,
    private readonly log_service: LogOperacionesService,
  ) {}

  async listar() {
    const tipos_tarea = await this.tipo_tarea_repo.find({
      where: { fecha_baja_tipo_tarea: IsNull() },
      order: { id_tipo_tarea: 'ASC' },
    });

    return {
      tipos_tarea: tipos_tarea.map((tipo) => this.to_response(tipo)),
    };
  }

  async crear(dto: CrearTipoTareaDto, actor: Usuario) {
    const nombre_tipo_tarea = dto.nombre_tipo_tarea.trim();
    await this.asegurar_nombre_libre(nombre_tipo_tarea);

    const tipo = await this.tipo_tarea_repo.save(
      this.tipo_tarea_repo.create({
        nombre_tipo_tarea,
        protegido: false,
        es_tipo_agroquimico: false,
        fecha_baja_tipo_tarea: null,
      }),
    );

    await this.log_service.registrar({
      usuario: actor,
      tipo_operacion: TipoOperacion.EXITO,
      descripcion: `Alta de tipo de tarea ${tipo.nombre_tipo_tarea}`,
      recurso: `TipoTarea:${tipo.id_tipo_tarea}`,
    });

    return {
      message: 'Tipo de tarea creado correctamente',
      ...this.to_response(tipo),
    };
  }

  async actualizar(
    id_tipo_tarea: number,
    dto: ActualizarTipoTareaDto,
    actor: Usuario,
  ) {
    const tipo = await this.require_activo(id_tipo_tarea);
    const nombre_tipo_tarea = dto.nombre_tipo_tarea.trim();
    await this.asegurar_nombre_libre(nombre_tipo_tarea, id_tipo_tarea);

    tipo.nombre_tipo_tarea = nombre_tipo_tarea;
    await this.tipo_tarea_repo.save(tipo);

    await this.log_service.registrar({
      usuario: actor,
      tipo_operacion: TipoOperacion.EXITO,
      descripcion: `Actualización de tipo de tarea ${tipo.nombre_tipo_tarea}`,
      recurso: `TipoTarea:${tipo.id_tipo_tarea}`,
    });

    return {
      message: 'Tipo de tarea actualizado correctamente',
      ...this.to_response(tipo),
    };
  }

  async dar_baja(id_tipo_tarea: number, actor: Usuario) {
    const tipo = await this.require_activo(id_tipo_tarea);
    if (tipo.protegido) {
      throw protectedCatalogItem();
    }

    const en_uso = await this.contar_asociadas(id_tipo_tarea);
    if (en_uso > 0) {
      throw resourceInUse(
        'No es posible dar de baja este tipo de tarea porque está en uso.',
      );
    }

    tipo.fecha_baja_tipo_tarea = new Date();
    await this.tipo_tarea_repo.save(tipo);

    await this.log_service.registrar({
      usuario: actor,
      tipo_operacion: TipoOperacion.OPERACION_DESTRUCTIVA,
      descripcion: `Baja de tipo de tarea ${tipo.nombre_tipo_tarea}`,
      recurso: `TipoTarea:${tipo.id_tipo_tarea}`,
    });

    return {
      message: 'Tipo de tarea dado de baja correctamente',
      id_tipo_tarea: Number(tipo.id_tipo_tarea),
    };
  }

  async find_activo_by_id(id_tipo_tarea: number): Promise<TipoTarea | null> {
    return this.tipo_tarea_repo.findOne({
      where: { id_tipo_tarea, fecha_baja_tipo_tarea: IsNull() },
    });
  }

  async ensure_seed(): Promise<void> {
    const existente = await this.tipo_tarea_repo.findOne({
      where: {
        protegido: true,
        es_tipo_agroquimico: true,
        fecha_baja_tipo_tarea: IsNull(),
      },
    });
    if (existente) {
      return;
    }

    await this.tipo_tarea_repo.save(
      this.tipo_tarea_repo.create({
        nombre_tipo_tarea: NOMBRE_TIPO_AGROQUIMICO,
        protegido: true,
        es_tipo_agroquimico: true,
        fecha_baja_tipo_tarea: null,
      }),
    );
  }

  private async contar_asociadas(id_tipo_tarea: number): Promise<number> {
    const tareas = await this.tarea_repo.count({
      where: { tipo_tarea: { id_tipo_tarea } },
    });
    const plantillas = await this.tarea_plantilla_repo.count({
      where: { tipo_tarea: { id_tipo_tarea } },
    });
    return tareas + plantillas;
  }

  private async require_activo(id_tipo_tarea: number): Promise<TipoTarea> {
    const tipo = await this.find_activo_by_id(id_tipo_tarea);
    if (!tipo) {
      throw resourceNotFound();
    }
    return tipo;
  }

  private async asegurar_nombre_libre(
    nombre_tipo_tarea: string,
    exclude_id?: number,
  ): Promise<void> {
    const existente = await this.tipo_tarea_repo.findOne({
      where: { nombre_tipo_tarea, fecha_baja_tipo_tarea: IsNull() },
    });
    if (
      existente &&
      (exclude_id == null ||
        Number(existente.id_tipo_tarea) !== Number(exclude_id))
    ) {
      throw duplicateValue('nombre_tipo_tarea');
    }
  }

  private to_response(tipo: TipoTarea) {
    return {
      id_tipo_tarea: Number(tipo.id_tipo_tarea),
      nombre_tipo_tarea: tipo.nombre_tipo_tarea,
      protegido: tipo.protegido,
      es_tipo_agroquimico: tipo.es_tipo_agroquimico,
    };
  }
}
