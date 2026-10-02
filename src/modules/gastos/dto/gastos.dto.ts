import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import {
  IsDateString,
  IsInt,
  IsNotEmpty,
  IsNumber,
  IsOptional,
  IsString,
  Matches,
  MaxLength,
  Min,
} from 'class-validator';
import { PageSizePaginationQueryDto } from '../../../common/dto/page-size-pagination.dto';

export class CrearGastoDto {
  @ApiProperty({ example: 'Fertilizante NPK', maxLength: 150 })
  @IsString()
  @IsNotEmpty()
  @MaxLength(150)
  nombre_insumo_gp: string;

  @ApiProperty({ example: 45000.5, description: 'Mayor a 0, hasta 2 decimales' })
  @Type(() => Number)
  @IsNumber({ maxDecimalPlaces: 2 })
  @Min(0.01)
  monto_gp: number;

  @ApiProperty({ example: 34, description: 'id_usuario_finca del responsable' })
  @Type(() => Number)
  @IsInt()
  @Min(1)
  id_responsable: number;

  @ApiProperty({ example: '2026-09-20' })
  @IsDateString()
  fecha_gp: string;
}

export class ActualizarGastoDto extends CrearGastoDto {}

export class ListarGastosQueryDto extends PageSizePaginationQueryDto {
  @ApiPropertyOptional({ example: '2026-09-01' })
  @IsOptional()
  @IsDateString()
  fecha_desde?: string;

  @ApiPropertyOptional({ example: '2026-09-30' })
  @IsOptional()
  @IsDateString()
  fecha_hasta?: string;
}

export class EvolucionMensualQueryDto {
  @ApiPropertyOptional({ example: '2026-04-01' })
  @IsOptional()
  @IsDateString()
  fecha_desde?: string;

  @ApiPropertyOptional({ example: '2026-09-30' })
  @IsOptional()
  @IsDateString()
  fecha_hasta?: string;
}

export class ExportarGastosDto {
  @ApiPropertyOptional({ example: '2026-04-01' })
  @IsOptional()
  @IsDateString()
  fecha_desde?: string;

  @ApiPropertyOptional({ example: '2026-09-30' })
  @IsOptional()
  @IsDateString()
  fecha_hasta?: string;

  @ApiProperty({
    example: 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAAB',
    description: 'PNG del gráfico de evolución como data URI',
  })
  @IsString()
  @IsNotEmpty()
  @Matches(/^data:image\/png;base64,/i, {
    message: 'imagen_grafico debe ser un PNG en formato data URI',
  })
  imagen_grafico: string;
}

export class GastoListadoItemDto {
  @ApiProperty({ example: 88 })
  id_gasto_produccion: number;

  @ApiProperty({ example: 'Fertilizante NPK' })
  nombre_insumo_gp: string;

  @ApiProperty({ example: 45000.5 })
  monto_gp: number;

  @ApiProperty({ example: '2026-09-20' })
  fecha_gp: string;

  @ApiProperty({ example: 34 })
  id_responsable: number;

  @ApiProperty({ example: 'Roberto Sánchez' })
  nombre_responsable: string;
}

export class GastoDetalleDto extends GastoListadoItemDto {
  @ApiProperty({ example: 12 })
  id_finca: number;

  @ApiProperty({ example: 'Finca La Esperanza' })
  nombre_finca: string;

  @ApiProperty({ example: '2026-09-22T09:03:10.000Z' })
  fecha_alta_gp: string;

  @ApiPropertyOptional({ example: '2026-09-23T11:00:00.000Z', nullable: true })
  fecha_modificacion_gp?: string | null;
}

export class CrearGastoResponseDto extends GastoDetalleDto {
  @ApiProperty({ example: 'Gasto registrado correctamente' })
  message: string;
}

export class ActualizarGastoResponseDto extends GastoDetalleDto {
  @ApiProperty({ example: 'Gasto actualizado correctamente' })
  message: string;
}

export class ListarGastosResponseDto {
  @ApiProperty({ type: [GastoListadoItemDto] })
  gastos: GastoListadoItemDto[];

  @ApiProperty({ example: 1 })
  total: number;

  @ApiProperty({ example: 1 })
  page: number;

  @ApiProperty({ example: 10 })
  pageSize: number;

  @ApiProperty({ example: 45000.5 })
  monto_total: number;

  @ApiProperty({ example: 45000.5 })
  monto_total_periodo: number;

  @ApiProperty({ example: 'mes_actual', enum: ['mes_actual', 'rango_filtrado'] })
  etiqueta_periodo: 'mes_actual' | 'rango_filtrado';
}

export class MesEvolucionDto {
  @ApiProperty({ example: '2026-04' })
  mes: string;

  @ApiProperty({ example: 12000 })
  monto: number;
}
