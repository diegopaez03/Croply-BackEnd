import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import {
  IsArray,
  IsInt,
  IsNotEmpty,
  IsOptional,
  IsString,
  MaxLength,
  Min,
  ValidateIf,
  ValidateNested,
} from 'class-validator';
import { es_aplicacion_agroquimico } from '../tipo-tarea.catalog';

export class PlantillaCultivoInputDto {
  @ApiProperty({ example: 45 })
  @IsInt()
  @Min(1)
  id_cultivo_base: number;

  @ApiPropertyOptional({
    example: 12,
    nullable: true,
    description: 'null = plantilla general (“Todas las variedades”)',
  })
  @IsOptional()
  @ValidateIf((_, value) => value != null)
  @IsInt()
  @Min(1)
  id_variedad?: number | null;
}

export class TareaPlantillaInputDto {
  @ApiProperty({ example: 0 })
  @IsInt()
  dia_relativo_tp: number;

  @ApiProperty({ example: 2 })
  @IsInt()
  @Min(1)
  id_tipo_tarea: number;

  @ApiProperty({ example: 'Preparación de almácigo' })
  @IsString()
  @IsNotEmpty()
  descripcion_tp: string;

  @ApiPropertyOptional({
    example: 'Cobre',
    nullable: true,
    description: 'Obligatorio si el tipo es Aplicación de agroquímico',
  })
  @ValidateIf((o: TareaPlantillaInputDto) =>
    es_aplicacion_agroquimico(o.id_tipo_tarea),
  )
  @IsString()
  @IsNotEmpty()
  nombre_producto?: string | null;

  @ApiPropertyOptional({
    example: '2 L/ha',
    nullable: true,
    description: 'Obligatorio si el tipo es Aplicación de agroquímico',
  })
  @ValidateIf((o: TareaPlantillaInputDto) =>
    es_aplicacion_agroquimico(o.id_tipo_tarea),
  )
  @IsString()
  @IsNotEmpty()
  dosis_aa?: string | null;
}

export class HitoPlantillaInputDto {
  @ApiProperty({ example: 'Siembra' })
  @IsString()
  @IsNotEmpty()
  @MaxLength(80)
  nombre_hpb: string;

  @ApiProperty({ example: 1 })
  @IsInt()
  @Min(1)
  orden_hpb: number;

  @ApiProperty({ type: [TareaPlantillaInputDto] })
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => TareaPlantillaInputDto)
  tareas: TareaPlantillaInputDto[];
}

export class CrearPlantillaBaseDto {
  @ApiProperty({ example: 'Plan de Cultivo de Tomate' })
  @IsString()
  @IsNotEmpty()
  @MaxLength(120)
  nombre_pb: string;

  @ApiProperty({ type: [PlantillaCultivoInputDto] })
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => PlantillaCultivoInputDto)
  cultivos: PlantillaCultivoInputDto[];

  @ApiProperty({ type: [HitoPlantillaInputDto] })
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => HitoPlantillaInputDto)
  hitos: HitoPlantillaInputDto[];
}
