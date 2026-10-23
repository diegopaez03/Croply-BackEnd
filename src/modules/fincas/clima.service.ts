import { HttpService } from '@nestjs/axios';
import { HttpStatus, Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { IsNull, Repository } from 'typeorm';
import { DomainException, resourceNotFound } from '../../common/exceptions';
import { Finca } from './entities/finca.entity';

export type CondicionClimatica =
  | 'Despejado'
  | 'Parcialmente nublado'
  | 'Nublado'
  | 'Niebla'
  | 'Lluvia'
  | 'Nieve'
  | 'Tormenta'
  | 'Tormenta eléctrica'
  | 'Helada'
  | 'Granizo'
  | 'Temperatura elevada';

export interface VariablesPronostico {
  temp_actual: number;
  humedad_relativa: number;
  temp_min_pronostico: number;
  temp_max_pronostico: number;
  precip_pronostico_24h: number;
  viento_kmh: number;
  wind_gust_kmh: number;
  et0_diario: number;
}

interface OpenMeteoVariablesResponse {
  current?: {
    temperature_2m?: number;
    relative_humidity_2m?: number;
  };
  daily?: {
    temperature_2m_max?: number[];
    temperature_2m_min?: number[];
    precipitation_sum?: number[];
    wind_speed_10m_max?: number[];
    wind_gusts_10m_max?: number[];
    et0_fao_evapotranspiration?: number[];
  };
}

interface OpenMeteoResponse {
  current_weather?: {
    temperature: number;
    weathercode?: number;
    weather_code?: number;
  };
  daily?: {
    time: string[];
    weathercode?: number[];
    weather_code?: number[];
    temperature_2m_max: number[];
    temperature_2m_min: number[];
  };
}

@Injectable()
export class ClimaService {
  constructor(
    @InjectRepository(Finca)
    private readonly finca_repo: Repository<Finca>,
    private readonly http: HttpService,
  ) {}

  async obtener_clima(id_finca: number) {
    const finca = await this.finca_repo.findOne({
      where: { id_finca, fecha_baja_finca: IsNull() },
    });
    if (!finca) {
      throw resourceNotFound();
    }

    try {
      const response = await this.http.axiosRef.get<OpenMeteoResponse>(
        'https://api.open-meteo.com/v1/forecast',
        {
          params: {
            latitude: parseFloat(finca.latitud),
            longitude: parseFloat(finca.longitud),
            current_weather: true,
            daily: 'weathercode,temperature_2m_max,temperature_2m_min',
            timezone: 'auto',
            forecast_days: 4,
          },
        },
      );
      return this.map_response(finca, response.data);
    } catch {
      throw new DomainException(
        'WEATHER_SERVICE_UNAVAILABLE',
        'No se pudo obtener la información climática en este momento.',
        HttpStatus.SERVICE_UNAVAILABLE,
      );
    }
  }

  async obtener_variables_pronostico(id_finca: number): Promise<VariablesPronostico> {
    const finca = await this.finca_repo.findOne({
      where: { id_finca, fecha_baja_finca: IsNull() },
    });
    if (!finca) {
      throw resourceNotFound();
    }

    try {
      const response = await this.http.axiosRef.get<OpenMeteoVariablesResponse>(
        'https://api.open-meteo.com/v1/forecast',
        {
          params: {
            latitude: parseFloat(finca.latitud),
            longitude: parseFloat(finca.longitud),
            current: 'temperature_2m,relative_humidity_2m',
            daily:
              'temperature_2m_max,temperature_2m_min,precipitation_sum,wind_speed_10m_max,wind_gusts_10m_max,et0_fao_evapotranspiration',
            timezone: 'auto',
            forecast_days: 2,
            wind_speed_unit: 'kmh',
          },
        },
      );
      return this.map_variables(response.data);
    } catch (error) {
      if (error instanceof DomainException) {
        throw error;
      }
      throw new DomainException(
        'WEATHER_SERVICE_UNAVAILABLE',
        'No se pudo obtener la información climática en este momento.',
        HttpStatus.SERVICE_UNAVAILABLE,
      );
    }
  }

  private map_variables(data: OpenMeteoVariablesResponse): VariablesPronostico {
    const dia = 1;
    const current = data.current;
    const daily = data.daily;
    const temp_actual = current?.temperature_2m;
    const humedad_relativa = current?.relative_humidity_2m;
    const temp_min = daily?.temperature_2m_min?.[dia];
    const temp_max = daily?.temperature_2m_max?.[dia];
    const precip = daily?.precipitation_sum?.[dia];
    const viento = daily?.wind_speed_10m_max?.[dia];
    const rafaga = daily?.wind_gusts_10m_max?.[dia];
    const et0 = daily?.et0_fao_evapotranspiration?.[dia];
    if (
      temp_actual === undefined ||
      humedad_relativa === undefined ||
      temp_min === undefined ||
      temp_max === undefined ||
      precip === undefined ||
      viento === undefined ||
      rafaga === undefined ||
      et0 === undefined
    ) {
      throw new Error('Pronóstico incompleto');
    }
    return {
      temp_actual,
      humedad_relativa,
      temp_min_pronostico: temp_min,
      temp_max_pronostico: temp_max,
      precip_pronostico_24h: precip,
      viento_kmh: viento,
      wind_gust_kmh: rafaga,
      et0_diario: et0,
    };
  }

  private map_response(finca: Finca, data: OpenMeteoResponse) {
    const current_weather = data.current_weather;
    const daily = data.daily;
    if (
      !current_weather ||
      !daily ||
      daily.time.length < 4 ||
      daily.temperature_2m_max.length < 4 ||
      daily.temperature_2m_min.length < 4
    ) {
      throw new Error('Respuesta climática incompleta');
    }

    const current_code = this.weather_code(current_weather);
    return {
      provincia: finca.provincia,
      departamento: finca.departamento,
      clima_actual: {
        temperatura: current_weather.temperature,
        condicion: this.condition_with_temperature(
          this.map_weather_code(current_code),
          current_weather.temperature,
          current_weather.temperature,
        ),
      },
      pronostico: daily.time.slice(0, 4).map((fecha, index) => {
        const temperatura_max = daily.temperature_2m_max[index];
        const temperatura_min = daily.temperature_2m_min[index];
        return {
          fecha,
          dia_semana: this.day_name(fecha),
          es_hoy: index === 0,
          temperatura_max,
          temperatura_min,
          condicion: this.condition_with_temperature(
            this.map_weather_code(
              this.weather_code({
                weathercode: daily.weathercode?.[index],
                weather_code: daily.weather_code?.[index],
              }),
            ),
            temperatura_min,
            temperatura_max,
          ),
        };
      }),
    };
  }

  private weather_code(weather: {
    weathercode?: number;
    weather_code?: number;
  }): number {
    const code = weather.weathercode ?? weather.weather_code;
    if (code === undefined) {
      throw new Error('Código climático ausente');
    }
    return code;
  }

  private map_weather_code(code: number): CondicionClimatica {
    if (code === 0) return 'Despejado';
    if ([1, 2].includes(code)) return 'Parcialmente nublado';
    if (code === 3) return 'Nublado';
    if ([45, 48].includes(code)) return 'Niebla';
    if ([51, 53, 55, 56, 57, 61, 63, 65, 66, 67, 80, 81, 82].includes(code)) {
      return 'Lluvia';
    }
    if ([71, 73, 75, 77, 85, 86].includes(code)) return 'Nieve';
    if (code === 95) return 'Tormenta';
    if ([96, 99].includes(code)) return 'Tormenta eléctrica';
    return 'Nublado';
  }

  private condition_with_temperature(
    base: CondicionClimatica,
    temperatura_min: number,
    temperatura_max: number,
  ): CondicionClimatica {
    // Decisión de negocio confirmada: si ambos umbrales se cumplen, prevalece Helada.
    if (temperatura_min <= 0) return 'Helada';
    if (temperatura_max >= 35) return 'Temperatura elevada';
    return base;
  }

  private day_name(fecha: string): string {
    const nombre = new Intl.DateTimeFormat('es-ES', {
      weekday: 'long',
      timeZone: 'UTC',
    }).format(new Date(`${fecha}T00:00:00Z`));
    return nombre.charAt(0).toUpperCase() + nombre.slice(1);
  }
}
