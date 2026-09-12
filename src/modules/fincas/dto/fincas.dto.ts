import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import {
  IsArray,
  IsEmail,
  IsEnum,
  IsInt,
  IsNotEmpty,
  IsNumber,
  IsOptional,
  IsString,
  Min,
} from 'class-validator';
import { EstadoUsuario } from '../../../common/enums';
import { PageSizePaginationQueryDto } from '../../../common/dto';
import {
  ActualizarPermisosDto,
  CrearRolFincaDto,
} from '../../roles/dto/crear-rol.dto';
import { ListarUsuariosQueryDto } from '../../usuarios/dto/usuarios.dto';

export class CrearInvitacionDto {
  @ApiProperty({ example: 'empleado@correo.com' })
  @IsEmail()
  @IsNotEmpty()
  email_invitado: string;

  @ApiProperty({ example: 21 })
  @IsInt()
  @Min(1)
  id_rol: number;
}

export class AsignarRolUsuarioFincaDto {
  @ApiProperty({ example: 21 })
  @IsInt()
  @Min(1)
  id_rol: number;
}

export class ListarUsuariosFincaQueryDto extends ListarUsuariosQueryDto {
  @ApiPropertyOptional({
    example: 12,
    description:
      'Acota el listado a una finca. Sin este parámetro se devuelven los usuarios de todas las fincas administradas.',
  })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  id_finca?: number;
}

export class ListarFincasQueryDto extends PageSizePaginationQueryDto {
  @ApiPropertyOptional({ enum: ['Activo', 'Inactivo'] })
  @IsOptional()
  @IsEnum(EstadoUsuario)
  estado?: EstadoUsuario;
}

export class CrearFincaDto {
  @ApiProperty({ example: 'Finca La Esperanza' })
  @IsString()
  @IsNotEmpty()
  nombre_finca: string;

  @ApiProperty({ example: 'Mendoza' })
  @IsString()
  @IsNotEmpty()
  provincia: string;

  @ApiProperty({ example: 'Capital' })
  @IsString()
  @IsNotEmpty()
  departamento: string;

  @ApiProperty({ example: '-68.8272' })
  @IsString()
  @IsNotEmpty()
  longitud: string;

  @ApiProperty({ example: '-32.8908' })
  @IsString()
  @IsNotEmpty()
  latitud: string;

  @ApiProperty({ example: 150.5 })
  @IsNumber()
  @Min(0)
  superficie_finca: number;

  @ApiPropertyOptional({ example: 'Finca dedicada al cultivo de maíz.' })
  @IsOptional()
  @IsString()
  descripcion_finca?: string;

  @ApiPropertyOptional({ example: null, nullable: true })
  @IsOptional()
  @IsInt()
  @Min(1)
  id_usuario_propietario?: number | null;

  @ApiPropertyOptional({ type: [Object], default: [] })
  @IsOptional()
  @IsArray()
  parcelas?: Record<string, unknown>[];
}

export class ActualizarFincaDto {
  @ApiPropertyOptional({ example: 'Finca La Esperanza' })
  @IsOptional()
  @IsString()
  @IsNotEmpty()
  nombre_finca?: string;

  @ApiPropertyOptional({ example: 150.5 })
  @IsOptional()
  @IsNumber()
  @Min(0)
  superficie_finca?: number;

  @ApiPropertyOptional({ example: 'Finca dedicada al cultivo de maíz.' })
  @IsOptional()
  @IsString()
  descripcion_finca?: string;
}

export class AsignarPropietarioDto {
  @ApiPropertyOptional({ example: 55, nullable: true })
  @IsOptional()
  @IsInt()
  @Min(1)
  id_usuario_propietario?: number | null;
}

export {
  CrearRolFincaDto,
  ActualizarPermisosDto,
  ListarUsuariosQueryDto,
};
