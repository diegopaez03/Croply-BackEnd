import { ApiProperty } from '@nestjs/swagger';
import { IsInt, IsNotEmpty, IsString, Min } from 'class-validator';

export class RegistrarInvitadoDto {
  @ApiProperty({ example: 102 })
  @IsInt()
  @Min(1)
  id_InvitacionFinca: number;

  @ApiProperty({ example: 'Luis' })
  @IsString()
  @IsNotEmpty()
  nombre: string;

  @ApiProperty({ example: 'Martínez' })
  @IsString()
  @IsNotEmpty()
  apellido: string;

  @ApiProperty({ example: 'InvitadoClave2026!' })
  @IsString()
  @IsNotEmpty()
  contrasena: string;
}
