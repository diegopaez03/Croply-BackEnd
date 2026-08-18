import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { EpocaCultivo, FormaSiembra } from '../../../common/enums';

export class CultivoBaseListItemDto {
  @ApiProperty({ example: 45 })
  id_cultivo_base: number;

  @ApiProperty({ example: 'Tomate' })
  nombre_cultivo_base: string;

  @ApiProperty({ example: 'Fruto nacional premium' })
  descripcion_cb: string;

  @ApiProperty({ enum: EpocaCultivo, example: EpocaCultivo.PRIMAVERA_VERANO })
  epoca_cultivo: EpocaCultivo;

  @ApiProperty({ example: 'Sep-Oct' })
  mes_siembra: string;

  @ApiProperty({ example: '70-90 días' })
  ciclo_productivo_cb: string;

  @ApiProperty({ enum: FormaSiembra, example: FormaSiembra.ALMACIGO })
  forma_siembra: FormaSiembra;

  @ApiProperty({ example: 2 })
  cantidad_variedades: number;
}

export class ListarCultivosBaseResponseDto {
  @ApiProperty({ type: [CultivoBaseListItemDto] })
  cultivos: CultivoBaseListItemDto[];
}

export class CrearCultivoBaseResponseDto extends CultivoBaseListItemDto {
  @ApiProperty({ example: 'Cultivo creado correctamente' })
  message: string;
}

export class VariedadDetalleDto {
  @ApiProperty({ example: 12 })
  id_variedad: number;

  @ApiProperty({ example: 'Perita' })
  nombre_variedad: string;

  @ApiProperty({ example: '30x60cm' })
  distancia_plantacion: string;

  @ApiPropertyOptional({
    example: 'Mas dulce, con menos semillas.',
    nullable: true,
  })
  observaciones: string | null;

  @ApiProperty({ example: 75 })
  dias_a_cosecha: number;

  @ApiProperty({ example: '2026-03-10' })
  fecha_alta: string;

  @ApiProperty({ example: true })
  en_uso: boolean;

  @ApiPropertyOptional({ example: 8, nullable: true })
  id_plantilla_especifica: number | null;
}

export class CultivoBaseDetalleDto {
  @ApiProperty({ example: 45 })
  id_cultivo_base: number;

  @ApiProperty({ example: 'Tomate' })
  nombre_cultivo_base: string;

  @ApiProperty({ example: 'Fruto nacional premium' })
  descripcion_cb: string;

  @ApiProperty({ enum: EpocaCultivo, example: EpocaCultivo.PRIMAVERA_VERANO })
  epoca_cultivo: EpocaCultivo;

  @ApiProperty({ example: 'Sep-Oct' })
  mes_siembra: string;

  @ApiProperty({ example: '70-90 días' })
  ciclo_productivo_cb: string;

  @ApiProperty({ enum: FormaSiembra, example: FormaSiembra.ALMACIGO })
  forma_siembra: FormaSiembra;

  @ApiPropertyOptional({ example: 3, nullable: true })
  id_plantilla_general: number | null;

  @ApiProperty({ type: [VariedadDetalleDto] })
  variedades: VariedadDetalleDto[];
}

export class VariedadMutacionResponseDto {
  @ApiProperty({ example: 'Variedad agregada correctamente' })
  message: string;

  @ApiProperty({ example: 12 })
  id_variedad: number;

  @ApiProperty({ example: 'Perita' })
  nombre_variedad: string;

  @ApiProperty({ example: '30x60cm' })
  distancia_plantacion: string;

  @ApiPropertyOptional({
    example: 'Mas dulce, con menos semillas.',
    nullable: true,
  })
  observaciones: string | null;

  @ApiProperty({ example: 75 })
  dias_a_cosecha: number;

  @ApiProperty({ example: '2026-03-10' })
  fecha_alta: string;

  @ApiProperty({ example: false })
  en_uso: boolean;

  @ApiProperty({ example: '68-75 días' })
  ciclo_productivo_cb: string;
}

export class MensajeCultivoResponseDto {
  @ApiProperty({ example: 'Cultivo actualizado correctamente' })
  message: string;
}
