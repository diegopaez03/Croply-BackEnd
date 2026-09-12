import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsEnum, IsIn, IsOptional, IsString } from 'class-validator';
import { EstadoSolicitud } from '../../../common/enums';
import { PageSizePaginationQueryDto } from '../../../common/dto';

export class ListarSolicitudesQueryDto extends PageSizePaginationQueryDto {
  @ApiPropertyOptional({
    example: 'pedro',
    description: 'Busca en nombre completo y correo electrónico',
  })
  @IsOptional()
  @IsString()
  search?: string;

  @ApiPropertyOptional({ enum: EstadoSolicitud })
  @IsOptional()
  @IsEnum(EstadoSolicitud)
  estado?: EstadoSolicitud;

  @ApiPropertyOptional({
    enum: ['ASC', 'DESC'],
    default: 'DESC',
    description: 'Orden por fecha de solicitud',
  })
  @IsOptional()
  @IsIn(['ASC', 'DESC', 'asc', 'desc'])
  orden_fecha?: 'ASC' | 'DESC' | 'asc' | 'desc';
}
