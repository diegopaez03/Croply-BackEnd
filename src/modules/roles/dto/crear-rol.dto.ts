import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsArray,
  IsInt,
  IsNotEmpty,
  IsOptional,
  IsString,
  Matches,
  MaxLength,
  Min,
  MinLength,
} from 'class-validator';

export class CrearRolSistemaDto {
  @ApiProperty({ example: 'Supervisor' })
  @IsString()
  @IsNotEmpty()
  @MinLength(3)
  @MaxLength(30)
  nombre_rol: string;

  @ApiPropertyOptional({ example: 'Supervisión de operaciones' })
  @IsOptional()
  @IsString()
  descripcion?: string;
}

export class CrearRolFincaDto {
  @ApiProperty({ example: 'Operario' })
  @IsString()
  @IsNotEmpty()
  @MinLength(3)
  @MaxLength(30)
  @Matches(/^[a-zA-Z0-9áéíóúÁÉÍÓÚñÑüÜ\s]+$/, {
    message: 'nombre_rol debe ser alfanumérico',
  })
  nombre_rol: string;

  @ApiPropertyOptional({ example: 'Trabajador de campo' })
  @IsOptional()
  @IsString()
  descripcion?: string;

  @ApiProperty({ example: [3, 7], type: [Number] })
  @IsArray()
  @IsInt({ each: true })
  @Min(1, { each: true })
  permisos: number[];
}

export class ActualizarPermisosDto {
  @ApiProperty({ example: [1, 2, 5], type: [Number] })
  @IsArray()
  @IsInt({ each: true })
  @Min(1, { each: true })
  permisos: number[];
}

export class AsignarRolSistemaDto {
  @ApiProperty({ example: 5 })
  @IsInt()
  @Min(1)
  id_rol: number;
}

export class AsignarRolFincaDto {
  @ApiProperty({ example: 21 })
  @IsInt()
  @Min(1)
  id_rol: number;
}
