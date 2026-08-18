import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsEnum, IsOptional, IsString } from 'class-validator';
import { EpocaCultivo, FormaSiembra } from '../../../common/enums';

export class ListarCultivosBaseQueryDto {
  @ApiPropertyOptional({
    example: 'tom',
    description:
      'Búsqueda parcial e insensible a mayúsculas sobre nombre_cultivo_base',
  })
  @IsOptional()
  @IsString()
  search?: string;

  @ApiPropertyOptional({
    enum: EpocaCultivo,
    description:
      'Si se omite o vale Todo_el_anio, no se aplica filtro de época',
  })
  @IsOptional()
  @IsEnum(EpocaCultivo)
  epoca_cultivo?: EpocaCultivo;

  @ApiPropertyOptional({ enum: FormaSiembra })
  @IsOptional()
  @IsEnum(FormaSiembra)
  forma_siembra?: FormaSiembra;
}
