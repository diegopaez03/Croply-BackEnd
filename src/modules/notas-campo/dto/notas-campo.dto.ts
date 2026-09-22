import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import {
  IsDateString,
  IsInt,
  IsNotEmpty,
  IsOptional,
  IsString,
  Min,
  ValidateIf,
} from 'class-validator';
import { CrearTareaPlanDto } from '../../planes-accion/dto/tareas-plan.dto';

export class CrearNotaCampoDto {
  @ApiProperty({ example: 12 })
  @Type(() => Number)
  @IsInt()
  @Min(1)
  id_finca: number;

  @ApiPropertyOptional({ example: 101, nullable: true })
  @IsOptional()
  @ValidateIf((_, value) => value != null)
  @Type(() => Number)
  @IsInt()
  @Min(1)
  id_parcela?: number | null;

  @ApiProperty({ example: 'Se observan manchas foliares en el sector norte.' })
  @IsString()
  @IsNotEmpty()
  contenido_nota_campo: string;

  @ApiPropertyOptional({ example: '2026-09-20T09:15:00Z' })
  @IsOptional()
  @IsDateString()
  fecha_captura_nc?: string;
}

export class ConvertirNotaDto extends CrearTareaPlanDto {
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
}
