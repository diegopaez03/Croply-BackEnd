import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import {
  IsDateString,
  IsEnum,
  IsInt,
  IsNotEmpty,
  IsOptional,
  IsString,
  MaxLength,
  Min,
} from 'class-validator';
import { EstadoPlanAccion, EstadoTarea } from '../../../common/enums';

export class CrearTareaPlanDto {
  @ApiProperty({ example: 'Aplicación de fungicida preventivo' })
  @IsString()
  @IsNotEmpty()
  @MaxLength(120)
  nombre_tarea: string;

  @ApiProperty({ example: 'Aplicación en pulverización foliar' })
  @IsString()
  @IsNotEmpty()
  descripcion_tarea: string;

  @ApiProperty({ example: '2026-09-20' })
  @IsDateString()
  fecha_planificada_tarea: string;

  @ApiProperty({ example: 5 })
  @Type(() => Number)
  @IsInt()
  @Min(1)
  id_tipo_tarea: number;

  @ApiPropertyOptional({ example: 'Fungicida XYZ', nullable: true })
  @IsOptional()
  @IsString()
  @MaxLength(120)
  nombre_producto_aa?: string | null;

  @ApiPropertyOptional({ example: '2 L/ha', nullable: true })
  @IsOptional()
  @IsString()
  @MaxLength(80)
  dosis_aa?: string | null;

  @ApiPropertyOptional({
    example: '2026-09-20T09:00:00Z',
    nullable: true,
  })
  @IsOptional()
  @IsDateString()
  fecha_hora_aplicacion_aa?: string | null;

  @ApiPropertyOptional({ example: 88, nullable: true })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  id_responsable?: number | null;
}

export class CambiarEstadoTareaDto {
  @ApiProperty({ enum: EstadoTarea, example: EstadoTarea.COMPLETADO })
  @IsEnum(EstadoTarea)
  estado: EstadoTarea;
}

export class CambiarEstadoPlanDto {
  @ApiProperty({
    enum: [
      EstadoPlanAccion.FINALIZADO,
      EstadoPlanAccion.CANCELADO,
      EstadoPlanAccion.FINALIZADO_POR_CONTINGENCIA,
    ],
    example: EstadoPlanAccion.FINALIZADO,
  })
  @IsEnum(EstadoPlanAccion)
  estado: EstadoPlanAccion;
}
