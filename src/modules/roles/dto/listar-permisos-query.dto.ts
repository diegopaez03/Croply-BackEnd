import { ApiProperty } from '@nestjs/swagger';
import { IsEnum } from 'class-validator';
import { AmbitoPermiso } from '../../../common/enums';

export class ListarPermisosQueryDto {
  @ApiProperty({ enum: AmbitoPermiso, example: AmbitoPermiso.SISTEMA })
  @IsEnum(AmbitoPermiso)
  ambito: AmbitoPermiso;
}
