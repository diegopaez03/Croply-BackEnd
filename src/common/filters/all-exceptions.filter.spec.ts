import { ArgumentsHost, BadRequestException, HttpStatus } from '@nestjs/common';
import { AllExceptionsFilter } from './all-exceptions.filter';
import {
  DomainException,
  duplicateValue,
  requiredField,
} from '../exceptions/domain.exception';

function createHostMock() {
  const json = jest.fn();
  const status = jest.fn().mockReturnValue({ json });
  const host = {
    switchToHttp: () => ({
      getResponse: () => ({ status }),
      getRequest: () => ({ url: '/api/v1/auth/login' }),
    }),
  } as unknown as ArgumentsHost;
  return { host, status, json };
}

describe('AllExceptionsFilter', () => {
  const filter = new AllExceptionsFilter();

  it('mapea campo obligatorio vacío a REQUIRED_FIELD', () => {
    const { host, status, json } = createHostMock();
    const exception = new BadRequestException({
      message: ['email should not be empty'],
      error: 'Bad Request',
      statusCode: 400,
    });

    filter.catch(exception, host);

    expect(status).toHaveBeenCalledWith(HttpStatus.BAD_REQUEST);
    expect(json).toHaveBeenCalledWith({
      statusCode: 400,
      errorCode: 'REQUIRED_FIELD',
      field: 'email',
      message: 'Campo requerido',
    });
  });

  it('mapea DomainException DUPLICATE_VALUE con field', () => {
    const { host, status, json } = createHostMock();

    filter.catch(duplicateValue('email'), host);

    expect(status).toHaveBeenCalledWith(HttpStatus.CONFLICT);
    expect(json).toHaveBeenCalledWith({
      statusCode: 409,
      errorCode: 'DUPLICATE_VALUE',
      field: 'email',
      message: 'El valor ingresado ya existe',
    });
  });

  it('mapea DomainException de dominio específica sin alterar el body', () => {
    const { host, status, json } = createHostMock();
    const exception = new DomainException(
      'INVALID_CREDENTIALS',
      'Correo electrónico o contraseña incorrectos',
      HttpStatus.UNAUTHORIZED,
    );

    filter.catch(exception, host);

    expect(status).toHaveBeenCalledWith(HttpStatus.UNAUTHORIZED);
    expect(json).toHaveBeenCalledWith({
      statusCode: 401,
      errorCode: 'INVALID_CREDENTIALS',
      message: 'Correo electrónico o contraseña incorrectos',
    });
  });

  it('mapea error inesperado a UNEXPECTED_ERROR', () => {
    const { host, status, json } = createHostMock();

    filter.catch(new Error('boom'), host);

    expect(status).toHaveBeenCalledWith(HttpStatus.INTERNAL_SERVER_ERROR);
    expect(json).toHaveBeenCalledWith({
      statusCode: 500,
      errorCode: 'UNEXPECTED_ERROR',
      message: 'Ha ocurrido un error, intente nuevamente',
    });
  });

  it('expone requiredField helper con el shape acordado', () => {
    const { host, status, json } = createHostMock();

    filter.catch(requiredField('contrasena'), host);

    expect(status).toHaveBeenCalledWith(HttpStatus.BAD_REQUEST);
    expect(json).toHaveBeenCalledWith({
      statusCode: 400,
      errorCode: 'REQUIRED_FIELD',
      field: 'contrasena',
      message: 'Campo requerido',
    });
  });
});
