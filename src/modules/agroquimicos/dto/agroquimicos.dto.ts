import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import {
  IsDateString,
  IsInt,
  IsNotEmpty,
  IsOptional,
  IsString,
  Max,
  Min,
} from 'class-validator';

export class CrearAplicacionAgroquimicoDto {
  @ApiProperty({ example: '2026-09-22T09:00:00Z' })
  @IsDateString()
  fecha_hora_aplicacion_aa: string;

  @ApiProperty({ example: 'Fungicida XYZ' })
  @IsString()
  @IsNotEmpty()
  nombre_producto_aa: string;

  @ApiProperty({ example: '2 L/ha' })
  @IsString()
  @IsNotEmpty()
  dosis_aa: string;

  @ApiPropertyOptional({
    example: 'Aplicar en horas de baja radiación solar',
  })
  @IsOptional()
  @IsString()
  observaciones?: string;

  @ApiProperty({ example: 101 })
  @Type(() => Number)
  @IsInt()
  @Min(1)
  id_parcela: number;

  @ApiProperty({ example: 201 })
  @Type(() => Number)
  @IsInt()
  @Min(1)
  id_hito_real: number;

  @ApiProperty({ example: 34 })
  @Type(() => Number)
  @IsInt()
  @Min(1)
  id_responsable: number;
}

export class ActualizarAplicacionAgroquimicoDto {
  @ApiProperty({ example: '2026-09-22T10:30:00Z' })
  @IsDateString()
  fecha_hora_aplicacion_aa: string;

  @ApiProperty({ example: 'Fungicida XYZ Plus' })
  @IsString()
  @IsNotEmpty()
  nombre_producto_aa: string;

  @ApiProperty({ example: '2.5 L/ha' })
  @IsString()
  @IsNotEmpty()
  dosis_aa: string;

  @ApiPropertyOptional({ example: 'Se reprogramó por lluvia' })
  @IsOptional()
  @IsString()
  observaciones?: string;

  @ApiProperty({ example: 41 })
  @Type(() => Number)
  @IsInt()
  @Min(1)
  id_responsable: number;
}

export class ListarAplicacionesQueryDto {
  @ApiPropertyOptional({ example: 1, default: 1, minimum: 1 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  page?: number = 1;

  @ApiPropertyOptional({ example: 10, default: 10, minimum: 1, maximum: 100 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(100)
  pageSize?: number = 10;

  @ApiPropertyOptional({ example: 101 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  id_parcela?: number;

  @ApiPropertyOptional({ example: '2026-09-01' })
  @IsOptional()
  @IsDateString()
  fecha_desde?: string;

  @ApiPropertyOptional({ example: '2026-09-30' })
  @IsOptional()
  @IsDateString()
  fecha_hasta?: string;

  @ApiPropertyOptional({ example: 34 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  id_responsable?: number;
}

export class ExportarAplicacionesQueryDto {
  @ApiPropertyOptional({ example: '2026-09-01' })
  @IsOptional()
  @IsDateString()
  fecha_desde?: string;

  @ApiPropertyOptional({ example: '2026-09-30' })
  @IsOptional()
  @IsDateString()
  fecha_hasta?: string;

  @ApiPropertyOptional({ example: 101 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  id_parcela?: number;
}

export class AplicacionListItemDto {
  @ApiProperty({ example: 55 })
  id_aplicacion: number;

  @ApiProperty({ example: '2026-09-22T09:00:00.000Z' })
  fecha_hora_aplicacion_aa: string | null;

  @ApiProperty({ example: 'Fungicida XYZ' })
  nombre_producto_aa: string | null;

  @ApiProperty({ example: '2 L/ha' })
  dosis_aa: string | null;

  @ApiProperty({ example: 101 })
  id_parcela: number;

  @ApiProperty({ example: 'Parcela Norte' })
  nombre_parcela: string;

  @ApiProperty({ example: 34, nullable: true })
  id_responsable: number | null;

  @ApiProperty({ example: 'Roberto Sánchez', nullable: true })
  nombre_responsable: string | null;
}

export class ListarAplicacionesResponseDto {
  @ApiProperty({ type: [AplicacionListItemDto] })
  aplicaciones: AplicacionListItemDto[];

  @ApiProperty({ example: 1 })
  total: number;

  @ApiProperty({ example: 1 })
  page: number;

  @ApiProperty({ example: 10 })
  pageSize: number;
}

export class AplicacionDetalleResponseDto extends AplicacionListItemDto {
  @ApiProperty({ example: 'Aplicación registrada correctamente' })
  message: string;

  @ApiProperty({
    example: 'Aplicar en horas de baja radiación solar',
    nullable: true,
  })
  observaciones: string | null;

  @ApiProperty({ example: 201 })
  id_hito_real: number | null;

  @ApiProperty({ example: 'Siembra' })
  nombre_hito: string | null;

  @ApiProperty({ example: 601 })
  id_tarea: number | null;

  @ApiProperty({ example: '2026-09-22T09:03:10.000Z' })
  fecha_creacion: string | null;

  @ApiPropertyOptional({ example: '2026-09-22T11:00:00.000Z' })
  fecha_modificacion?: string | null;
}
