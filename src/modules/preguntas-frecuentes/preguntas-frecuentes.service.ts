import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { IsNull, Repository } from 'typeorm';
import {
  build_page_size_pagination,
  PageSizePaginationQueryDto,
} from '../../common/dto';
import { TipoOperacion } from '../../common/enums';
import { duplicateValue, resourceNotFound } from '../../common/exceptions';
import { LogOperacionesService } from '../log-operaciones';
import { Usuario } from '../usuarios/entities/usuario.entity';
import { ActualizarPreguntaFrecuenteDto } from './dto/actualizar-pregunta-frecuente.dto';
import { CrearPreguntaFrecuenteDto } from './dto/crear-pregunta-frecuente.dto';
import { PreguntaFrecuente } from './entities/pregunta-frecuente.entity';
import { normalizar_pregunta } from './normalizar-pregunta.util';

const collator = new Intl.Collator('es');

@Injectable()
export class PreguntasFrecuentesService {
  constructor(
    @InjectRepository(PreguntaFrecuente)
    private readonly pregunta_frecuente_repo: Repository<PreguntaFrecuente>,
    private readonly log_service: LogOperacionesService,
  ) {}

  async listar_gestion(query: PageSizePaginationQueryDto) {
    const page = query.page ?? 1;
    const pageSize = query.pageSize ?? 10;

    const [preguntas, totalItems] =
      await this.pregunta_frecuente_repo.findAndCount({
        where: { fecha_baja_pf: IsNull() },
        order: { fecha_alta_pf: 'DESC', id_pregunta_frecuente: 'DESC' },
        skip: (page - 1) * pageSize,
        take: pageSize,
      });

    return {
      preguntas_frecuentes: preguntas.map((p) => this.to_item(p)),
      pagination: build_page_size_pagination(page, pageSize, totalItems),
    };
  }

  async listar() {
    const preguntas = await this.pregunta_frecuente_repo.find({
      where: { fecha_baja_pf: IsNull() },
    });

    const ordenadas = preguntas
      .map((p) => ({ item: this.to_item(p), clave: normalizar_pregunta(p.pregunta) }))
      .sort(
        (a, b) =>
          collator.compare(a.clave, b.clave) ||
          a.item.id_pregunta_frecuente - b.item.id_pregunta_frecuente,
      );

    return {
      preguntas_frecuentes: ordenadas.map(({ item }) => item),
    };
  }

  async crear(dto: CrearPreguntaFrecuenteDto, actor: Usuario) {
    await this.asegurar_pregunta_libre(dto.pregunta);

    const pregunta = await this.pregunta_frecuente_repo.save(
      this.pregunta_frecuente_repo.create({
        pregunta: dto.pregunta,
        respuesta: dto.respuesta,
      }),
    );

    await this.log_service.registrar({
      usuario: actor,
      tipo_operacion: TipoOperacion.EXITO,
      descripcion: `Alta de pregunta frecuente "${pregunta.pregunta}"`,
      recurso: `PreguntaFrecuente:${pregunta.id_pregunta_frecuente}`,
    });

    return {
      message: 'Pregunta frecuente creada correctamente.',
      ...this.to_item(pregunta),
    };
  }

  async actualizar(
    id_pregunta_frecuente: number,
    dto: ActualizarPreguntaFrecuenteDto,
    actor: Usuario,
  ) {
    const pregunta = await this.require_pregunta_activa(id_pregunta_frecuente);
    await this.asegurar_pregunta_libre(dto.pregunta, id_pregunta_frecuente);

    pregunta.pregunta = dto.pregunta;
    pregunta.respuesta = dto.respuesta;
    await this.pregunta_frecuente_repo.save(pregunta);

    await this.log_service.registrar({
      usuario: actor,
      tipo_operacion: TipoOperacion.EXITO,
      descripcion: `Actualización de pregunta frecuente "${pregunta.pregunta}"`,
      recurso: `PreguntaFrecuente:${pregunta.id_pregunta_frecuente}`,
    });

    return {
      message: 'Pregunta frecuente actualizada correctamente.',
      ...this.to_item(pregunta),
    };
  }

  async dar_baja(id_pregunta_frecuente: number, actor: Usuario) {
    const pregunta = await this.require_pregunta_activa(id_pregunta_frecuente);

    pregunta.fecha_baja_pf = new Date();
    await this.pregunta_frecuente_repo.save(pregunta);

    await this.log_service.registrar({
      usuario: actor,
      tipo_operacion: TipoOperacion.OPERACION_DESTRUCTIVA,
      descripcion: `Baja de pregunta frecuente "${pregunta.pregunta}"`,
      recurso: `PreguntaFrecuente:${pregunta.id_pregunta_frecuente}`,
    });

    return {
      message: 'Pregunta frecuente eliminada correctamente.',
      id_pregunta_frecuente: Number(pregunta.id_pregunta_frecuente),
    };
  }

  private to_item(pregunta: PreguntaFrecuente) {
    return {
      id_pregunta_frecuente: Number(pregunta.id_pregunta_frecuente),
      pregunta: pregunta.pregunta,
      respuesta: pregunta.respuesta,
    };
  }

  private async require_pregunta_activa(
    id_pregunta_frecuente: number,
  ): Promise<PreguntaFrecuente> {
    const pregunta = await this.pregunta_frecuente_repo.findOne({
      where: { id_pregunta_frecuente, fecha_baja_pf: IsNull() },
    });

    if (!pregunta) {
      throw resourceNotFound();
    }

    return pregunta;
  }

  /**
   * La unicidad se evalúa sobre la clave de normalización (decisión 6), que se
   * calcula en memoria: el volumen esperado es de decenas de filas.
   */
  private async asegurar_pregunta_libre(
    pregunta: string,
    excluir_id?: number,
  ): Promise<void> {
    const clave = normalizar_pregunta(pregunta);
    const activas = await this.pregunta_frecuente_repo.find({
      select: { id_pregunta_frecuente: true, pregunta: true },
      where: { fecha_baja_pf: IsNull() },
    });

    const duplicada = activas.some(
      (p) =>
        Number(p.id_pregunta_frecuente) !== excluir_id &&
        normalizar_pregunta(p.pregunta) === clave,
    );

    if (duplicada) {
      throw duplicateValue('pregunta');
    }
  }
}
