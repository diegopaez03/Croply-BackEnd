import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

/**
 * Generic success envelope for single-resource responses.
 * Prefer documenting concrete types in controllers; use this as a shared base.
 */
export class ApiResponseDto<T = unknown> {
  @ApiProperty({
    description: 'Indica si la operación fue exitosa',
    example: true,
  })
  success: boolean;

  @ApiPropertyOptional({
    description: 'Mensaje descriptivo opcional',
    example: 'Operación completada correctamente',
  })
  message?: string;

  @ApiProperty({ description: 'Payload de la respuesta' })
  data: T;
}

/**
 * Simple message-only response (e.g. delete confirmations).
 */
export class MessageResponseDto {
  @ApiProperty({
    description: 'Mensaje de confirmación',
    example: 'Recurso eliminado correctamente',
  })
  message: string;
}
