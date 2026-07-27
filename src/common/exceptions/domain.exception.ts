import { HttpException, HttpStatus } from '@nestjs/common';

export type DomainErrorCode =
  | 'REQUIRED_FIELD'
  | 'DUPLICATE_VALUE'
  | 'UNEXPECTED_ERROR'
  | 'INVALID_CREDENTIALS'
  | 'ACCOUNT_NOT_ACTIVE'
  | 'INVITATION_ALREADY_USED'
  | 'INVITATION_EXPIRED'
  | 'PASSWORD_MISMATCH'
  | 'TOKEN_EXPIRED'
  | 'CURRENT_PASSWORD_INCORRECT'
  | 'FORBIDDEN'
  | 'UNAUTHORIZED'
  | 'RESOURCE_IN_USE'
  | 'RESOURCE_NOT_FOUND'
  | 'NO_PERMISSIONS_SELECTED'
  | 'STATE_NOT_ALLOWED'
  | 'PENDING_INVITATION_EXISTS'
  | 'USER_ALREADY_LINKED';

export interface DomainExceptionBody {
  statusCode: number;
  errorCode: DomainErrorCode;
  message: string;
  field?: string;
  [key: string]: unknown;
}

export class DomainException extends HttpException {
  constructor(
    public readonly errorCode: DomainErrorCode,
    message: string,
    statusCode: HttpStatus,
    public readonly field?: string,
    public readonly extra?: Record<string, unknown>,
  ) {
    const body: DomainExceptionBody = {
      statusCode,
      errorCode,
      message,
      ...(field !== undefined ? { field } : {}),
      ...(extra ?? {}),
    };
    super(body, statusCode);
  }
}

export function requiredField(field: string): DomainException {
  return new DomainException(
    'REQUIRED_FIELD',
    'Campo requerido',
    HttpStatus.BAD_REQUEST,
    field,
  );
}

export function duplicateValue(field: string): DomainException {
  return new DomainException(
    'DUPLICATE_VALUE',
    'El valor ingresado ya existe',
    HttpStatus.CONFLICT,
    field,
  );
}

export function unexpectedError(): DomainException {
  return new DomainException(
    'UNEXPECTED_ERROR',
    'Ha ocurrido un error, intente nuevamente',
    HttpStatus.INTERNAL_SERVER_ERROR,
  );
}

export function resourceNotFound(
  message = 'El recurso solicitado no existe o ya fue eliminado.',
): DomainException {
  return new DomainException(
    'RESOURCE_NOT_FOUND',
    message,
    HttpStatus.NOT_FOUND,
  );
}

export function resourceInUse(message: string): DomainException {
  return new DomainException('RESOURCE_IN_USE', message, HttpStatus.CONFLICT);
}
