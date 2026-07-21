import { ApiProperty } from '@nestjs/swagger';
import { IsNotEmpty, IsString } from 'class-validator';

export class ResetearContrasenaDto {
  @ApiProperty({ example: 'a1b2c3d4e5f6g7h8i9j0' })
  @IsString()
  @IsNotEmpty()
  token_hash: string;

  @ApiProperty({ example: 'NuevaClave456!' })
  @IsString()
  @IsNotEmpty()
  nueva_contrasena: string;

  @ApiProperty({ example: 'NuevaClave456!' })
  @IsString()
  @IsNotEmpty()
  confirmar_contrasena: string;
}
