import { ApiProperty } from '@nestjs/swagger';
import { IsNotEmpty, IsString } from 'class-validator';

export class ContrasenaPrimerAccesoDto {
  @ApiProperty({ example: 'MiPrimerClaveSegura1!' })
  @IsString()
  @IsNotEmpty()
  nueva_contrasena: string;

  @ApiProperty({ example: 'MiPrimerClaveSegura1!' })
  @IsString()
  @IsNotEmpty()
  confirmar_contrasena: string;
}
