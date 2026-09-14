import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import {
  IsArray,
  IsDateString,
  IsInt,
  IsNumber,
  IsOptional,
  Min,
  ValidateNested,
} from 'class-validator';

export class PlanPreviewQueryDto {
  @ApiProperty({ example: 101 })
  @Type(() => Number)
  @IsInt()
  @Min(1)
  id_parcela: number;
}

export class AsignacionPlanAccionDto {
  @ApiProperty({ example: 12 })
  @Type(() => Number)
  @IsInt()
  @Min(1)
  id_variedad: number;

  @ApiProperty({ example: 5.0 })
  @IsNumber()
  @Min(0)
  superficie_asignada: number;

  @ApiProperty({ example: '2026-09-15' })
  @IsDateString()
  fecha_inicio: string;
}

export class CrearPlanAccionDto {
  @ApiProperty({ example: 45 })
  @Type(() => Number)
  @IsInt()
  @Min(1)
  id_cultivo_base: number;

  @ApiProperty({ type: [AsignacionPlanAccionDto] })
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => AsignacionPlanAccionDto)
  asignaciones: AsignacionPlanAccionDto[];
}
