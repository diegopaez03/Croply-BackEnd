import { ApiProperty } from '@nestjs/swagger';
import { IsNotEmpty, IsString, MaxLength } from 'class-validator';

export class CrearTipoTareaDto {
  @ApiProperty({ example: 'Poda' })
  @IsString()
  @IsNotEmpty()
  @MaxLength(120)
  nombre_tipo_tarea: string;
}
