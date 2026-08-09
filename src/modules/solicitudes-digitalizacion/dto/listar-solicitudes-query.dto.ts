import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsEnum, IsOptional, IsString } from 'class-validator';
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
}
