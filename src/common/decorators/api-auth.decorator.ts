import { applyDecorators } from '@nestjs/common';
import { ApiBearerAuth, ApiUnauthorizedResponse } from '@nestjs/swagger';
import { ErrorResponseDto } from '../dto/error-response.dto';

/**
 * Marks an endpoint (or controller) as requiring JWT Bearer auth
 * and documents the 401 response.
 *
 * The security scheme name must match `addBearerAuth(..., 'access-token')`
 * in the Swagger DocumentBuilder.
 */
export function ApiAuth() {
  return applyDecorators(
    ApiBearerAuth('access-token'),
    ApiUnauthorizedResponse({
      description: 'Token ausente, inválido o expirado',
      type: ErrorResponseDto,
    }),
  );
}
