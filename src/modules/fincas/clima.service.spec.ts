import { HttpStatus } from '@nestjs/common';
import { ClimaService } from './clima.service';

function respuesta_clima(overrides: Record<string, unknown> = {}) {
  return {
    current_weather: {
      temperature: 24.5,
      weathercode: 2,
    },
    daily: {
      time: ['2026-08-27', '2026-08-28', '2026-08-29', '2026-08-30'],
      weathercode: [2, 61, 3, 0],
      temperature_2m_max: [24, 19, 21, 23],
      temperature_2m_min: [14, 11, 12, 13],
    },
    ...overrides,
  };
}

describe('ClimaService', () => {
  let service: ClimaService;
  let finca_repo: { findOne: jest.Mock };
  let http: { axiosRef: { get: jest.Mock } };

  beforeEach(() => {
    finca_repo = {
      findOne: jest.fn().mockResolvedValue({
        id_finca: 1,
        latitud: '-32.957431',
        longitud: '-68.771205',
        provincia: 'Mendoza',
        departamento: 'Capital',
        fecha_baja_finca: null,
      }),
    };
    http = { axiosRef: { get: jest.fn() } };
    service = new ClimaService(finca_repo as never, http as never);
  });

  it('mapea códigos WMO a condiciones del contrato', async () => {
    http.axiosRef.get.mockResolvedValue({
      data: respuesta_clima({
        current_weather: { temperature: 24.5, weathercode: 0 },
        daily: {
          time: ['2026-08-27', '2026-08-28', '2026-08-29', '2026-08-30'],
          weathercode: [0, 45, 71, 95],
          temperature_2m_max: [24, 19, 21, 23],
          temperature_2m_min: [14, 11, 12, 13],
        },
      }),
    });

    const result = await service.obtener_clima(1);

    expect(result.clima_actual.condicion).toBe('Despejado');
    expect(result.pronostico.map((dia) => dia.condicion)).toEqual([
      'Despejado',
      'Niebla',
      'Nieve',
      'Tormenta',
    ]);
  });

  it('aplica Helada y Temperatura elevada con los umbrales exactos', async () => {
    http.axiosRef.get.mockResolvedValue({
      data: respuesta_clima({
        current_weather: { temperature: 0, weathercode: 3 },
        daily: {
          time: ['2026-08-27', '2026-08-28', '2026-08-29', '2026-08-30'],
          weathercode: [3, 3, 3, 3],
          temperature_2m_max: [34, 35, 36, 34],
          temperature_2m_min: [1, 0, -1, 1],
        },
      }),
    });

    const result = await service.obtener_clima(1);

    expect(result.clima_actual.condicion).toBe('Helada');
    expect(result.pronostico.map((dia) => dia.condicion)).toEqual([
      'Nublado',
      'Helada',
      'Helada',
      'Nublado',
    ]);
  });

  it('evalúa Temperatura elevada contra la máxima del día', async () => {
    http.axiosRef.get.mockResolvedValue({
      data: respuesta_clima({
        daily: {
          time: ['2026-08-27', '2026-08-28', '2026-08-29', '2026-08-30'],
          weathercode: [3, 3, 3, 3],
          temperature_2m_max: [35, 34, 35, 34],
          temperature_2m_min: [10, 10, 10, 10],
        },
      }),
    });

    const result = await service.obtener_clima(1);

    expect(result.pronostico.map((dia) => dia.condicion)).toEqual([
      'Temperatura elevada',
      'Nublado',
      'Temperatura elevada',
      'Nublado',
    ]);
  });

  it('devuelve siempre cuatro entradas de pronóstico y marca hoy', async () => {
    http.axiosRef.get.mockResolvedValue({ data: respuesta_clima() });

    const result = await service.obtener_clima(1);

    expect(result.pronostico).toHaveLength(4);
    expect(result.pronostico.filter((dia) => dia.es_hoy)).toHaveLength(1);
    expect(result.pronostico[0].es_hoy).toBe(true);
    expect(result.pronostico.slice(1).every((dia) => !dia.es_hoy)).toBe(true);
    expect(http.axiosRef.get).toHaveBeenCalledWith(
      'https://api.open-meteo.com/v1/forecast',
      expect.objectContaining({
        params: expect.objectContaining({
          latitude: -32.957431,
          longitude: -68.771205,
          forecast_days: 4,
        }),
      }),
    );
  });

  it('lanza 503 literal si Open-Meteo falla', async () => {
    http.axiosRef.get.mockRejectedValue(new Error('network error'));

    await expect(service.obtener_clima(1)).rejects.toMatchObject({
      errorCode: 'WEATHER_SERVICE_UNAVAILABLE',
      status: HttpStatus.SERVICE_UNAVAILABLE,
      message: 'No se pudo obtener la información climática en este momento.',
    });
  });
});
