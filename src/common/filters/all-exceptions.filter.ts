import {
  ArgumentsHost,
  BadRequestException,
  Catch,
  ExceptionFilter,
  HttpException,
  HttpStatus,
  Logger,
} from '@nestjs/common';
import { Response } from 'express';
import {
  DomainException,
  DomainExceptionBody,
} from '../exceptions/domain.exception';

@Catch()
export class AllExceptionsFilter implements ExceptionFilter {
  private readonly logger = new Logger(AllExceptionsFilter.name);

  catch(exception: unknown, host: ArgumentsHost): void {
    const ctx = host.switchToHttp();
    const response = ctx.getResponse<Response>();

    const body = this.toErrorBody(exception);
    response.status(body.statusCode).json(body);
  }

  private toErrorBody(exception: unknown): DomainExceptionBody {
    if (exception instanceof DomainException) {
      return exception.getResponse() as DomainExceptionBody;
    }

    if (exception instanceof BadRequestException) {
      const mapped = this.mapValidationException(exception);
      if (mapped) {
        return mapped;
      }
    }

    if (exception instanceof HttpException) {
      const statusCode = exception.getStatus();
      const res = exception.getResponse();
      if (this.isDomainBody(res)) {
        return res;
      }
      const message =
        typeof res === 'string'
          ? res
          : typeof res === 'object' && res !== null && 'message' in res
            ? Array.isArray((res as { message: unknown }).message)
              ? ((res as { message: string[] }).message[0] ?? exception.message)
              : String((res as { message: unknown }).message)
            : exception.message;

      return {
        statusCode,
        errorCode:
          statusCode === HttpStatus.FORBIDDEN
            ? 'FORBIDDEN'
            : statusCode === HttpStatus.UNAUTHORIZED
              ? 'UNAUTHORIZED'
              : statusCode >= 500
                ? 'UNEXPECTED_ERROR'
                : 'UNEXPECTED_ERROR',
        message:
          statusCode >= 500
            ? 'Ha ocurrido un error, intente nuevamente'
            : message,
      };
    }

    this.logger.error(
      exception instanceof Error ? exception.stack : String(exception),
    );

    return {
      statusCode: HttpStatus.INTERNAL_SERVER_ERROR,
      errorCode: 'UNEXPECTED_ERROR',
      message: 'Ha ocurrido un error, intente nuevamente',
    };
  }

  private mapValidationException(
    exception: BadRequestException,
  ): DomainExceptionBody | null {
    const res = exception.getResponse();
    if (typeof res !== 'object' || res === null) {
      return null;
    }

    const messages = (res as { message?: string | string[] }).message;
    const list = Array.isArray(messages)
      ? messages
      : typeof messages === 'string'
        ? [messages]
        : [];

    const required = list.find(
      (m) =>
        m.includes('should not be empty') ||
        m.includes('must be a') ||
        m.includes('is required'),
    );

    if (!required) {
      return null;
    }

    const field = required.split(' ')[0] ?? 'unknown';
    return {
      statusCode: HttpStatus.BAD_REQUEST,
      errorCode: 'REQUIRED_FIELD',
      field,
      message: 'Campo requerido',
    };
  }

  private isDomainBody(value: unknown): value is DomainExceptionBody {
    return (
      typeof value === 'object' &&
      value !== null &&
      'statusCode' in value &&
      'errorCode' in value &&
      'message' in value
    );
  }
}
