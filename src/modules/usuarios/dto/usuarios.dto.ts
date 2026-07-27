import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import {
  IsEnum,
  IsInt,
  IsNotEmpty,
  IsOptional,
  IsString,
  Min,
  MinLength,
} from 'class-validator';
import { EstadoUsuario } from '../../../common/enums';
import { PageSizePaginationQueryDto } from '../../../common/dto';

export class ListarUsuariosQueryDto extends PageSizePaginationQueryDto {
  @ApiPropertyOptional({ example: 'carlos' })
  @IsOptional()
  @IsString()
  search?: string;

  @ApiPropertyOptional({ example: 21 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  id_rol?: number;

  @ApiPropertyOptional({ enum: EstadoUsuario })
  @IsOptional()
  @IsEnum(EstadoUsuario)
  estado?: EstadoUsuario;
}

export class ActualizarEstadoUsuarioDto {
  @ApiProperty({ enum: EstadoUsuario, example: EstadoUsuario.INACTIVO })
  @IsEnum(EstadoUsuario)
  estado: EstadoUsuario;
}

export class ActualizarPerfilDto {
  @ApiProperty({ example: 'Carlos' })
  @IsString()
  @IsNotEmpty()
  @MinLength(1)
  nombre: string;

  @ApiProperty({ example: 'Mendoza' })
  @IsString()
  @IsNotEmpty()
  @MinLength(1)
  apellido: string;

  @ApiPropertyOptional({ example: '+549115550999' })
  @IsOptional()
  @IsString()
  telefono?: string;

  /** No editable; se ignora si llega en el body. */
  @ApiPropertyOptional({ description: 'Ignorado si se envía' })
  @IsOptional()
  email?: string;
}

export class AsignarRolSistemaBodyDto {
  @ApiProperty({ example: 5 })
  @IsInt()
  @Min(1)
  id_rol: number;
}
