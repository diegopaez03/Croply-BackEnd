import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

/**
 * Standard error body returned by the API (contrato Épica 1).
 */
export class ErrorResponseDto {
  @ApiProperty({
    description: 'Código HTTP del error',
    example: 400,
  })
  statusCode: number;

  @ApiProperty({
    description: 'Código de error de dominio para el cliente',
    example: 'REQUIRED_FIELD',
  })
  errorCode: string;

  @ApiProperty({
    description: 'Mensaje legible para mostrar al usuario',
    example: 'Campo requerido',
  })
  message: string;

  @ApiPropertyOptional({
    description: 'Campo del formulario asociado al error (ERR-01 / ERR-02)',
    example: 'email',
  })
  field?: string;
}
