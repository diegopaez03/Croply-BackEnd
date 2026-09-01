import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsInt,
  IsNotEmpty,
  IsOptional,
  IsString,
  MaxLength,
  Min,
} from 'class-validator';

export class CrearVariedadDto {
  @ApiProperty({ example: 'Perita' })
  @IsString()
  @IsNotEmpty()
  @MaxLength(80)
  nombre_variedad: string;

  @ApiProperty({ example: '30x60cm' })
  @IsString()
  @IsNotEmpty()
  @MaxLength(40)
  distancia_plantacion: string;

  @ApiPropertyOptional({
    example: 'Mas dulce, con menos semillas.',
    nullable: true,
  })
  @IsOptional()
  @IsString()
  observaciones?: string | null;

  @ApiProperty({ example: 75 })
  @IsInt()
  @Min(1)
  dias_a_cosecha: number;
}
