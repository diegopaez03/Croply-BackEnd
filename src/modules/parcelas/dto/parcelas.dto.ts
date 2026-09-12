import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import {
  IsArray,
  IsInt,
  IsNotEmpty,
  IsNumber,
  IsOptional,
  IsString,
  Min,
  ValidateNested,
} from 'class-validator';

export class CrearSensorDto {
  @ApiProperty({ example: 15 })
  @Type(() => Number)
  @IsInt()
  @Min(1)
  id_tipo_sensor: number;

  @ApiProperty({ example: '192.168.1.11' })
  @IsString()
  @IsNotEmpty()
  ip_sensor: string;
}

export class ActualizarSensorDto extends CrearSensorDto {
  @ApiPropertyOptional({ example: 501 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  id_sensor?: number;
}

export class CrearControladorSensorDto {
  @ApiProperty({ example: 'Controlador Norte' })
  @IsString()
  @IsNotEmpty()
  nombre_controlador: string;

  @ApiProperty({ example: '192.168.1.10' })
  @IsString()
  @IsNotEmpty()
  ip_controlador: string;

  @ApiPropertyOptional({ type: [CrearSensorDto], default: [] })
  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => CrearSensorDto)
  sensores?: CrearSensorDto[];
}

export class ActualizarControladorSensorDto extends CrearControladorSensorDto {
  @ApiPropertyOptional({ example: 7 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  id_controlador_sensor?: number;

  @ApiPropertyOptional({ type: [ActualizarSensorDto], default: [] })
  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => ActualizarSensorDto)
  declare sensores?: ActualizarSensorDto[];
}

export class CrearParcelaDto {
  @ApiProperty({ example: 'Lote Norte' })
  @IsString()
  @IsNotEmpty()
  nombre_parcela: string;

  @ApiProperty({ example: 12.5 })
  @IsNumber()
  @Min(0)
  superficie_parcela: number;

  @ApiPropertyOptional({ type: [CrearControladorSensorDto], default: [] })
  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => CrearControladorSensorDto)
  controladores?: CrearControladorSensorDto[];
}

export class ActualizarParcelaDto {
  @ApiPropertyOptional({ example: 'Lote Norte' })
  @IsOptional()
  @IsString()
  @IsNotEmpty()
  nombre_parcela?: string;

  @ApiPropertyOptional({ example: 12.5 })
  @IsOptional()
  @IsNumber()
  @Min(0)
  superficie_parcela?: number;

  @ApiPropertyOptional({ type: [ActualizarControladorSensorDto], default: [] })
  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => ActualizarControladorSensorDto)
  controladores?: ActualizarControladorSensorDto[];
}
