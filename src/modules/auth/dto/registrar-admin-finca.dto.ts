import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsEmail,
  IsEnum,
  IsNotEmpty,
  IsOptional,
  IsString,
  ValidateIf,
} from 'class-validator';
import { EstadoUsuario } from '../../../common/enums';

export class RegistrarAdminFincaDto {
  @ApiProperty({ example: 'nuevoadmin@finca.com' })
  @IsEmail()
  @IsNotEmpty()
  email: string;

  @ApiProperty({ example: 'Carlos' })
  @IsString()
  @IsNotEmpty()
  nombre: string;

  @ApiProperty({ example: 'Gómez' })
  @IsString()
  @IsNotEmpty()
  apellido: string;

  @ApiPropertyOptional({ example: '+5493511234567' })
  @IsOptional()
  @IsString()
  telefono?: string;

  @ApiProperty({ example: 'TempClave123!' })
  @IsString()
  @IsNotEmpty()
  contrasena_temporal: string;

  @ApiPropertyOptional({ example: null, nullable: true })
  @ValidateIf((_, v) => v !== null && v !== undefined)
  @IsOptional()
  id_Rol?: number | null;

  @ApiProperty({ enum: EstadoUsuario, example: EstadoUsuario.PENDIENTE })
  @IsEnum(EstadoUsuario)
  @IsNotEmpty()
  estado: EstadoUsuario;
}
