import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { TipoNotificacion } from '../../alertas-climaticas/enums/tipo-notificacion.enum';

export class NotificacionResponseDto {
  @ApiProperty()
  id_notificacion: number;

  @ApiProperty({ enum: TipoNotificacion })
  tipo: TipoNotificacion;

  @ApiProperty()
  titulo: string;

  @ApiProperty()
  descripcion: string;

  @ApiProperty()
  leida: boolean;

  @ApiProperty()
  fecha_creacion: string;

  @ApiPropertyOptional({ nullable: true })
  fecha_lectura: string | null;

  @ApiPropertyOptional({ nullable: true })
  id_finca: number | null;

  @ApiPropertyOptional({ nullable: true })
  id_parcela: number | null;

  @ApiPropertyOptional({ nullable: true })
  id_tarea: number | null;
}

export class ListadoNotificacionesResponseDto {
  @ApiProperty()
  no_leidas: number;

  @ApiProperty({ type: [NotificacionResponseDto] })
  notificaciones: NotificacionResponseDto[];
}
