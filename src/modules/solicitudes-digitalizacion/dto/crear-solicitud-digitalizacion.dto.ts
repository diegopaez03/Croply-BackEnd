import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsEmail,
  IsNotEmpty,
  IsNumber,
  IsOptional,
  IsString,
  Min,
} from 'class-validator';
import { Type } from 'class-transformer';

export class CrearSolicitudDigitalizacionDto {
  @ApiProperty({ example: 'Pedro Picapiedra' })
  @IsString()
  @IsNotEmpty()
  nombre_completo: string;

  @ApiProperty({ example: 'pedro@cantera.com' })
  @IsEmail()
  @IsNotEmpty()
  correo_electronico: string;

  @ApiProperty({ example: '+5493512345678' })
  @IsString()
  @IsNotEmpty()
  telefono_contacto: string;

  @ApiProperty({ example: 'Córdoba' })
  @IsString()
  @IsNotEmpty()
  provincia: string;

  @ApiProperty({ example: 'Capital' })
  @IsString()
  @IsNotEmpty()
  departamento: string;

  @ApiProperty({ example: 'Córdoba' })
  @IsString()
  @IsNotEmpty()
  localidad: string;

  @ApiProperty({ example: 4 })
  @Type(() => Number)
  @IsNumber()
  @Min(1)
  numero_parcelas: number;

  @ApiProperty({ example: 150.5 })
  @Type(() => Number)
  @IsNumber()
  @Min(0)
  superficie_total_hectareas: number;

  @ApiPropertyOptional({
    example: 'Finca dedicada al cultivo de maíz primavera-verano.',
  })
  @IsOptional()
  @IsString()
  comentario_adicional?: string;
}
