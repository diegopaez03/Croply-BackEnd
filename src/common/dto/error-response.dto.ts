import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

/**
 * Standard error body returned by the API.
 * Align exception filters with this shape so clients and Swagger stay in sync.
 */
export class ErrorResponseDto {
  @ApiProperty({
    description: 'Código HTTP del error',
    example: 400,
  })
  statusCode: number;

  @ApiProperty({
    description: 'Mensaje de error (string o lista de validaciones)',
    oneOf: [
      { type: 'string', example: 'Bad Request' },
      {
        type: 'array',
        items: { type: 'string' },
        example: ['email must be an email', 'password should not be empty'],
      },
    ],
  })
  message: string | string[];

  @ApiProperty({
    description: 'Nombre corto del error HTTP',
    example: 'Bad Request',
  })
  error: string;

  @ApiProperty({
    description: 'Momento del error en ISO 8601',
    example: '2026-07-20T15:30:00.000Z',
  })
  timestamp: string;

  @ApiProperty({
    description: 'Ruta del request que generó el error',
    example: '/api/auth/login',
  })
  path: string;

  @ApiPropertyOptional({
    description: 'Identificador de correlación (si está disponible)',
    example: 'req_8f3a2c1b',
  })
  requestId?: string;
}
