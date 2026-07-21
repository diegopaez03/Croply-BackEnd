import { applyDecorators } from '@nestjs/common';
import {
  ApiBadRequestResponse,
  ApiConflictResponse,
  ApiForbiddenResponse,
  ApiGoneResponse,
  ApiInternalServerErrorResponse,
  ApiNotFoundResponse,
  ApiUnauthorizedResponse,
  ApiTooManyRequestsResponse,
} from '@nestjs/swagger';
import { ErrorResponseDto } from '../dto/error-response.dto';

export interface ApiErrorResponsesOptions {
  /** Include 401 Unauthorized (default: true) */
  unauthorized?: boolean;
  /** Include 403 Forbidden (default: false) */
  forbidden?: boolean;
  /** Include 404 Not Found (default: false) */
  notFound?: boolean;
  /** Include 400 Bad Request (default: true) */
  badRequest?: boolean;
  /** Include 409 Conflict (default: false) */
  conflict?: boolean;
  /** Include 410 Gone (default: false) */
  gone?: boolean;
  /** Include 429 Too Many Requests (default: true) */
  tooManyRequests?: boolean;
  /** Include 500 Internal Server Error (default: true) */
  internalServerError?: boolean;
}

/**
 * Applies the standard set of error response schemas to an endpoint.
 * Prefer this over repeating `@Api*Response` on every handler.
 */
export function ApiErrorResponses(options: ApiErrorResponsesOptions = {}) {
  const {
    unauthorized = true,
    forbidden = false,
    notFound = false,
    badRequest = true,
    conflict = false,
    gone = false,
    tooManyRequests = true,
    internalServerError = true,
  } = options;

  const decorators = [];

  if (badRequest) {
    decorators.push(
      ApiBadRequestResponse({
        description: 'Solicitud inválida (validación o parámetros incorrectos)',
        type: ErrorResponseDto,
      }),
    );
  }

  if (unauthorized) {
    decorators.push(
      ApiUnauthorizedResponse({
        description: 'No autenticado o token inválido/expirado',
        type: ErrorResponseDto,
      }),
    );
  }

  if (forbidden) {
    decorators.push(
      ApiForbiddenResponse({
        description: 'Autenticado pero sin permisos para este recurso',
        type: ErrorResponseDto,
      }),
    );
  }

  if (notFound) {
    decorators.push(
      ApiNotFoundResponse({
        description: 'Recurso no encontrado',
        type: ErrorResponseDto,
      }),
    );
  }

  if (conflict) {
    decorators.push(
      ApiConflictResponse({
        description: 'Conflicto (valor duplicado)',
        type: ErrorResponseDto,
      }),
    );
  }

  if (gone) {
    decorators.push(
      ApiGoneResponse({
        description: 'Recurso o token ya no disponible',
        type: ErrorResponseDto,
      }),
    );
  }

  if (tooManyRequests) {
    decorators.push(
      ApiTooManyRequestsResponse({
        description: 'Límite de rate limiting excedido',
        type: ErrorResponseDto,
      }),
    );
  }

  if (internalServerError) {
    decorators.push(
      ApiInternalServerErrorResponse({
        description: 'Error interno del servidor',
        type: ErrorResponseDto,
      }),
    );
  }

  return applyDecorators(...decorators);
}
