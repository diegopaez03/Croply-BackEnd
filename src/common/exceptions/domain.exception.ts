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
  | 'UNAUTHORIZED';

export interface DomainExceptionBody {
  statusCode: number;
  errorCode: DomainErrorCode;
  message: string;
  field?: string;
}

export class DomainException extends HttpException {
  constructor(
    public readonly errorCode: DomainErrorCode,
    message: string,
    statusCode: HttpStatus,
    public readonly field?: string,
  ) {
    const body: DomainExceptionBody = {
      statusCode,
      errorCode,
      message,
      ...(field !== undefined ? { field } : {}),
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
