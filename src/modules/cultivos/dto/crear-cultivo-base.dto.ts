import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsEnum, IsNotEmpty, IsOptional, IsString, MaxLength } from 'class-validator';
import { EpocaCultivo, FormaSiembra } from '../../../common/enums';

export class CrearCultivoBaseDto {
  @ApiProperty({ example: 'Tomate' })
  @IsString()
  @IsNotEmpty()
  @MaxLength(80)
  nombre_cultivo_base: string;

  @ApiProperty({ example: 'Fruto nacional premium' })
  @IsString()
  @IsNotEmpty()
  descripcion_cb: string;

  @ApiProperty({ enum: EpocaCultivo, example: EpocaCultivo.PRIMAVERA_VERANO })
  @IsEnum(EpocaCultivo)
  epoca_cultivo: EpocaCultivo;

  @ApiProperty({ example: 'Sep-Oct' })
  @IsString()
  @IsNotEmpty()
  @MaxLength(40)
  mes_siembra: string;

  @ApiProperty({
    example: '70-90 días',
    description:
      'Obligatorio al crear. Si el cultivo ya tiene variedades, el backend lo recalcula y ignora este valor.',
  })
  @IsString()
  @IsNotEmpty()
  @MaxLength(40)
  ciclo_productivo_cb: string;

  @ApiProperty({ enum: FormaSiembra, example: FormaSiembra.ALMACIGO })
  @IsEnum(FormaSiembra)
  forma_siembra: FormaSiembra;

  @ApiPropertyOptional({
    example: 'https://res.cloudinary.com/demo/image/upload/v1/croply/tomate.jpg',
    nullable: true,
  })
  @IsOptional()
  @IsString()
  @MaxLength(500)
  imagen_url?: string | null;
}
