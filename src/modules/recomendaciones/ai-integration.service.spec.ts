import { HttpStatus } from '@nestjs/common';
import { AiIntegrationService } from './ai-integration.service';

describe('AiIntegrationService', () => {
  let http: { axiosRef: { post: jest.Mock } };
  let service: AiIntegrationService;

  beforeEach(() => {
    http = { axiosRef: { post: jest.fn() } };
    service = new AiIntegrationService(
      http as never,
      { get: jest.fn().mockReturnValue('http://localhost:8001/') } as never,
    );
  });

  it('devuelve AI_SERVICE_UNAVAILABLE si el microservicio no responde', async () => {
    http.axiosRef.post.mockRejectedValue(new Error('connect ECONNREFUSED'));

    await expect(service.evaluate_parcel({} as never)).rejects.toMatchObject({
      errorCode: 'AI_SERVICE_UNAVAILABLE',
      status: HttpStatus.SERVICE_UNAVAILABLE,
      message:
        'El motor de recomendaciones no se encuentra disponible en este momento. Mostrando última información conocida.',
    });
  });

  it('mapea un cultivo no soportado del motor a CROP_NOT_SUPPORTED', async () => {
    const error = Object.assign(new Error('rechazado'), {
      response: {
        status: 400,
        data: {
          detail:
            "Cultivo 'frutilla' no soportado. Disponibles: ['tomate', 'ajo']",
        },
      },
    });
    http.axiosRef.post.mockRejectedValue(error);

    await expect(service.evaluate_parcel({} as never)).rejects.toMatchObject({
      errorCode: 'CROP_NOT_SUPPORTED',
      status: HttpStatus.BAD_REQUEST,
      message:
        'Las recomendaciones todavía no están disponibles para el cultivo Frutilla.',
    });
  });

  it('devuelve AI_SERVICE_UNAVAILABLE ante un 500 del motor', async () => {
    const error = Object.assign(new Error('fallo'), {
      isAxiosError: true,
      response: { status: 500 },
    });
    http.axiosRef.post.mockRejectedValue(error);

    await expect(service.evaluate_climate({} as never)).rejects.toMatchObject({
      errorCode: 'AI_SERVICE_UNAVAILABLE',
    });
  });
});
