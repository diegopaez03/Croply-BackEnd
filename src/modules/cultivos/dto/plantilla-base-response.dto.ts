import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { PageSizePaginationDto } from '../../../common/dto';
import { EpocaCultivo } from '../../../common/enums';

export class PlantillaListCultivoDto {
  @ApiProperty({ example: 23 })
  id_pbcv: number;

  @ApiProperty({ example: 45 })
  id_cultivo_base: number;

  @ApiPropertyOptional({ example: 12, nullable: true })
  id_variedad: number | null;
}

export class PlantillaBaseListItemDto {
  @ApiProperty({ example: 3 })
  id_plantilla_base: number;

  @ApiProperty({ example: 'Plan de Cultivo de Ajo' })
  nombre_pb: string;

  @ApiProperty({ type: [PlantillaListCultivoDto] })
  cultivos: PlantillaListCultivoDto[];

  @ApiProperty({ example: 28 })
  cantidad_tareas: number;
}

export class ListarPlantillasBaseResponseDto {
  @ApiProperty({ type: [PlantillaBaseListItemDto] })
  plantillas: PlantillaBaseListItemDto[];

  @ApiProperty({ type: PageSizePaginationDto })
  pagination: PageSizePaginationDto;
}

export class CultivoResumenDto {
  @ApiProperty({ example: 45 })
  id_cultivo_base: number;

  @ApiProperty({ example: 'Tomate' })
  nombre_cultivo_base: string;

  @ApiProperty({ enum: EpocaCultivo })
  epoca_cultivo: EpocaCultivo;

  @ApiProperty({ example: 'Sep-Oct' })
  mes_siembra: string;

  @ApiProperty({ example: '70-90 días' })
  ciclo_productivo_cb: string;
}

export class TareaPlantillaDetalleDto {
  @ApiProperty({ example: 33 })
  id_tarea_plantilla: number;

  @ApiProperty({ example: 0 })
  dia_relativo_tp: number;

  @ApiProperty({ example: 2 })
  id_tipo_tarea: number;

  @ApiProperty({ example: 'Siembra' })
  nombre_tipo_tarea: string;

  @ApiProperty({ example: 'Preparación de almácigo' })
  descripcion_tp: string;

  @ApiPropertyOptional({ example: 'Cobre 50%', nullable: true })
  nombre_producto?: string | null;

  @ApiPropertyOptional({ example: '2 L/ha', nullable: true })
  dosis_aa?: string | null;
}

export class HitoPlantillaDetalleDto {
  @ApiProperty({ example: 10 })
  id_hito_plantilla: number;

  @ApiProperty({ example: 'Siembra' })
  nombre_hpb: string;

  @ApiProperty({ example: 1 })
  orden_hpb: number;

  @ApiProperty({ type: [TareaPlantillaDetalleDto] })
  tareas: TareaPlantillaDetalleDto[];
}

export class PlantillaPcvDetalleDto {
  @ApiProperty({ example: 23 })
  id_pbcv: number;

  @ApiProperty({ type: CultivoResumenDto })
  cultivo_base: CultivoResumenDto;

  @ApiPropertyOptional({ nullable: true })
  variedad: Record<string, unknown> | null;
}

export class PlantillaBaseDetalleDto {
  @ApiProperty({ example: 3 })
  id_plantilla_base: number;

  @ApiProperty({ example: 'Plan de Cultivo de Tomate' })
  nombre_pb: string;

  @ApiProperty({ type: [CultivoResumenDto] })
  cultivos_info: CultivoResumenDto[];

  @ApiProperty({ type: [PlantillaPcvDetalleDto] })
  cultivos: PlantillaPcvDetalleDto[];

  @ApiProperty({ type: [HitoPlantillaDetalleDto] })
  hitos: HitoPlantillaDetalleDto[];
}

export class CrearPlantillaBaseResponseDto extends PlantillaBaseDetalleDto {
  @ApiProperty({ example: 'Plantilla creada correctamente' })
  message: string;
}

export class MensajePlantillaResponseDto {
  @ApiProperty({ example: 'Plantilla eliminada correctamente' })
  message: string;
}
