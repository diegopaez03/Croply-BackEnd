import { ApiProperty } from '@nestjs/swagger';
import { IsNotEmpty, IsString, MaxLength } from 'class-validator';

export class CrearEstadoTareaDto {
  @ApiProperty({ example: 'En Progreso' })
  @IsString()
  @IsNotEmpty()
  @MaxLength(120)
  nombre_estado_tarea: string;
}
