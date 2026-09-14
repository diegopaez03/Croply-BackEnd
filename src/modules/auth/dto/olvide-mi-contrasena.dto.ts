import { ApiProperty } from '@nestjs/swagger';
import { IsEmail, IsNotEmpty } from 'class-validator';

export class OlvideMiContrasenaDto {
  @ApiProperty({ example: 'usuario@finca.com' })
  @IsEmail()
  @IsNotEmpty()
  email: string;
}
