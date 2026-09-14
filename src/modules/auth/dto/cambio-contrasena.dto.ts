import { ApiProperty } from '@nestjs/swagger';
import { IsNotEmpty, IsString } from 'class-validator';

export class CambioContrasenaDto {
  @ApiProperty({ example: 'ViejaClave123!' })
  @IsString()
  @IsNotEmpty()
  contrasena_actual: string;

  @ApiProperty({ example: 'NuevaClave456!' })
  @IsString()
  @IsNotEmpty()
  nueva_contrasena: string;

  @ApiProperty({ example: 'NuevaClave456!' })
  @IsString()
  @IsNotEmpty()
  confirmar_contrasena: string;
}
