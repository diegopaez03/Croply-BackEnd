import { ApiProperty } from '@nestjs/swagger';

export class SoporteConfiguracionResponseDto {
  @ApiProperty({
    description:
      'URL externa del manual de usuario. `null` si no está configurada o es inválida.',
    example: 'https://ejemplo.com/manual-croply',
    nullable: true,
    type: String,
  })
  manual_usuario_url: string | null;

  @ApiProperty({
    description:
      'Correo oficial de soporte. `null` si no está configurado o es inválido.',
    example: 'croplyagronomia@gmail.com',
    nullable: true,
    type: String,
  })
  email_soporte: string | null;
}
