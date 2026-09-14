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
