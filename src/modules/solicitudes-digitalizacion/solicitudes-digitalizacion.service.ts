import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { EstadoSolicitud, TipoOperacion } from '../../common/enums';
import { build_page_size_pagination } from '../../common/dto';
import { resourceNotFound } from '../../common/exceptions';
import { LogOperacionesService } from '../log-operaciones';
import { Usuario } from '../usuarios/entities/usuario.entity';
import { SolicitudDigitalizacionFinca } from './entities/solicitud-digitalizacion-finca.entity';
import { CrearSolicitudDigitalizacionDto } from './dto/crear-solicitud-digitalizacion.dto';
import { ActualizarEstadoSolicitudDto } from './dto/actualizar-estado-solicitud.dto';
import { ListarSolicitudesQueryDto } from './dto/listar-solicitudes-query.dto';

@Injectable()
export class SolicitudesDigitalizacionService {
  constructor(
    @InjectRepository(SolicitudDigitalizacionFinca)
    private readonly solicitud_repo: Repository<SolicitudDigitalizacionFinca>,
    private readonly log_service: LogOperacionesService,
  ) {}

  async crear(
    dto: CrearSolicitudDigitalizacionDto,
    usuario?: Usuario | null,
  ) {
    const solicitud = await this.solicitud_repo.save(
      this.solicitud_repo.create({
        nombre_completo: dto.nombre_completo,
        correo_electronico: dto.correo_electronico.toLowerCase(),
        telefono_contacto: dto.telefono_contacto,
        provincia: dto.provincia,
        departamento: dto.departamento,
        localidad: dto.localidad,
        numero_parcelas: dto.numero_parcelas,
        superficie_total_hectareas: dto.superficie_total_hectareas,
        comentario_adicional: dto.comentario_adicional ?? null,
        estado: EstadoSolicitud.PENDIENTE,
        usuario: usuario ?? null,
      }),
    );

    await this.log_service.registrar({
      usuario: usuario ?? null,
      tipo_operacion: TipoOperacion.EXITO,
      descripcion: 'Alta de solicitud de digitalización',
      recurso: `SolicitudDigitalizacionFinca:${solicitud.id_solicitud_df}`,
    });

    return {
      message:
        '¡Solicitud enviada con éxito! Nuestro equipo se pondrá en contacto a la brevedad.',
      id_solicitud_df: Number(solicitud.id_solicitud_df),
      nombre_completo: solicitud.nombre_completo,
      correo_electronico: solicitud.correo_electronico,
      estado: solicitud.estado,
      fecha_solicitud: solicitud.fecha_solicitud.toISOString(),
    };
  }

  async listar(query: ListarSolicitudesQueryDto) {
    const page = query.page ?? 1;
    const pageSize = query.pageSize ?? 10;

    const listQb = this.solicitud_repo.createQueryBuilder('s');

    if (query.search?.trim()) {
      const term = `%${query.search.trim().toLowerCase()}%`;
      listQb.andWhere(
        '(LOWER(s.nombre_completo) LIKE :term OR LOWER(s.correo_electronico) LIKE :term)',
        { term },
      );
    }
    if (query.estado) {
      listQb.andWhere('s.estado = :estado', { estado: query.estado });
    }

    const [solicitudes, totalItems] = await listQb
      .orderBy('s.fecha_solicitud', 'DESC')
      .skip((page - 1) * pageSize)
      .take(pageSize)
      .getManyAndCount();

    return {
      solicitudes: solicitudes.map((s) => ({
        id_solicitud_df: Number(s.id_solicitud_df),
        fecha_solicitud: s.fecha_solicitud.toISOString(),
        nombre_completo: s.nombre_completo,
        correo_electronico: s.correo_electronico,
        telefono_contacto: s.telefono_contacto,
        estado: s.estado,
      })),
      pagination: build_page_size_pagination(page, pageSize, totalItems),
    };
  }

  async detalle(id_solicitud_df: number) {
    const s = await this.solicitud_repo.findOne({
      where: { id_solicitud_df },
    });
    if (!s) {
      throw resourceNotFound();
    }

    return {
      id_solicitud_df: Number(s.id_solicitud_df),
      fecha_solicitud: s.fecha_solicitud.toISOString(),
      nombre_completo: s.nombre_completo,
      correo_electronico: s.correo_electronico,
      telefono_contacto: s.telefono_contacto,
      provincia: s.provincia,
      departamento: s.departamento,
      localidad: s.localidad,
      numero_parcelas: s.numero_parcelas,
      superficie_total_hectareas: Number(s.superficie_total_hectareas),
      comentario_adicional: s.comentario_adicional,
      estado: s.estado,
    };
  }

  async actualizar_estado(
    id_solicitud_df: number,
    dto: ActualizarEstadoSolicitudDto,
    actor: Usuario,
  ) {
    const s = await this.solicitud_repo.findOne({
      where: { id_solicitud_df },
    });
    if (!s) {
      throw resourceNotFound();
    }

    s.estado = dto.estado;
    await this.solicitud_repo.save(s);

    await this.log_service.registrar({
      usuario: actor,
      tipo_operacion: TipoOperacion.EXITO,
      descripcion: `Actualización de estado de solicitud a ${dto.estado}`,
      recurso: `SolicitudDigitalizacionFinca:${s.id_solicitud_df}`,
    });

    return { message: 'Estado actualizado correctamente.' };
  }
}
