import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { EstadoSolicitud } from '../../common/enums';
import { Usuario } from '../usuarios/entities/usuario.entity';
import { SolicitudDigitalizacionFinca } from './entities/solicitud-digitalizacion-finca.entity';
import { CrearSolicitudDigitalizacionDto } from './dto/crear-solicitud-digitalizacion.dto';

@Injectable()
export class SolicitudesDigitalizacionService {
  constructor(
    @InjectRepository(SolicitudDigitalizacionFinca)
    private readonly solicitud_repo: Repository<SolicitudDigitalizacionFinca>,
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

    return {
      message:
        '¡Solicitud enviada con éxito! Nuestro equipo se pondrá en contacto a la brevedad.',
      id_Solicitud: Number(solicitud.id_solicitud_df),
      nombre_completo: solicitud.nombre_completo,
      correo_electronico: solicitud.correo_electronico,
      estado: solicitud.estado,
      fecha_solicitud: solicitud.fecha_solicitud.toISOString(),
    };
  }
}
