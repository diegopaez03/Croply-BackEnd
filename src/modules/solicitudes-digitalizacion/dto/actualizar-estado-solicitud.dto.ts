import { ApiProperty } from '@nestjs/swagger';
import { IsEnum } from 'class-validator';
import { EstadoSolicitud } from '../../../common/enums';

export class ActualizarEstadoSolicitudDto {
  @ApiProperty({ enum: EstadoSolicitud, example: EstadoSolicitud.CONTACTADO })
  @IsEnum(EstadoSolicitud)
  estado: EstadoSolicitud;
}
