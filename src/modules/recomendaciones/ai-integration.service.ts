import { HttpService } from '@nestjs/axios';
import { HttpStatus, Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import {
  DomainException,
  aiServiceUnavailable,
  cropNotSupported,
} from '../../common/exceptions';

export interface EvaluateParcelPayload {
  parcela_id: string;
  finca_id?: string;
  cultivo: string;
  variedad?: string;
  dias_desde_siembra: number;
  hora_del_dia?: number;
  accion_previa?: string;
  telemetria_iot: {
    temp_ambiente_c: number | null;
    humedad_ambiente_pct: number | null;
    humedad_suelo_pct: number | null;
    radiacion_solar_wm2: number | null;
    ph_suelo: number | null;
    lluvia_mm_24h: number | null;
  };
  pronostico_meteo: {
    temp_min_pronostico: number;
    temp_max_pronostico: number;
    precip_pronostico_24h: number;
    viento_kmh: number;
    wind_gust_kmh: number;
    et0_diario: number;
  };
  historial_manejo: {
    dias_desde_ultimo_riego: number;
    dias_desde_ultima_curacion: number;
  };
}

export interface RecomendacionVigente {
  titulo_corto: string;
  texto_breve: string;
  texto_explicativo_extendido: string;
}

export interface AiEvaluationResponse {
  accion_recomendada: string;
  severidad: string;
  sensor_origen_principal: string;
  explicabilidad_top3_factores: Array<{
    sensor_ui: string;
    valor: number | null;
  }>;
  recomendacion_vigente: RecomendacionVigente | null;
  fuente_generacion: string;
}

export interface ContextoCultivoClima {
  cultivo: string;
  etapa_fenologica_idx: number;
}

export interface EvaluateClimatePayload {
  temp_min_pronostico: number;
  temp_max_pronostico: number;
  precip_pronostico_24h: number;
  viento_kmh: number;
  wind_gust_kmh: number;
  humedad_relativa: number;
  temp_actual: number;
  contextos: ContextoCultivoClima[];
}

export interface AlertaMotor {
  codigo_alerta: string;
  severidad: string;
  descripcion: string;
}

const TIMEOUT_MS = 10_000;

@Injectable()
export class AiIntegrationService {
  private readonly logger = new Logger(AiIntegrationService.name);
  private readonly base_url: string;

  constructor(
    private readonly http: HttpService,
    config: ConfigService,
  ) {
    this.base_url = config
      .get<string>('AI_SERVICE_URL', 'http://localhost:8001')
      .replace(/\/$/, '');
  }

  async evaluate_parcel(
    payload: EvaluateParcelPayload,
  ): Promise<AiEvaluationResponse> {
    return this.post<AiEvaluationResponse>(
      '/api/v1/ai/evaluate-parcel',
      payload,
    );
  }

  async evaluate_climate(
    payload: EvaluateClimatePayload,
  ): Promise<AlertaMotor[]> {
    const data = await this.post<{ alertas_climaticas?: AlertaMotor[] }>(
      '/api/v1/ai/evaluate-climate',
      payload,
    );
    return data.alertas_climaticas ?? [];
  }

  private async post<T>(path: string, payload: unknown): Promise<T> {
    try {
      const response = await this.http.axiosRef.post<T>(
        `${this.base_url}${path}`,
        payload,
        {
          timeout: TIMEOUT_MS,
          headers: { 'Content-Type': 'application/json' },
        },
      );
      return response.data;
    } catch (error) {
      this.logger.error(
        `El servicio de IA no respondió en ${path}: ${
          error instanceof Error ? error.message : String(error)
        }`,
      );
      const respuesta = this.respuesta_http(error);
      if (respuesta && respuesta.status < 500) {
        const message = this.mensaje_detalle(respuesta.data);
        const cultivo = this.cultivo_rechazado(message);
        if (cultivo) {
          throw cropNotSupported(cultivo);
        }
        throw new DomainException(
          'UNEXPECTED_ERROR',
          message,
          HttpStatus.BAD_REQUEST,
        );
      }
      throw aiServiceUnavailable();
    }
  }

  private mensaje_detalle(data: unknown): string {
    if (
      typeof data === 'object' &&
      data !== null &&
      'detail' in data &&
      typeof (data as { detail?: unknown }).detail === 'string'
    ) {
      return (data as { detail: string }).detail;
    }
    return 'La evaluación agronómica fue rechazada.';
  }

  private cultivo_rechazado(message: string): string | null {
    const coincidencia = message.match(/Cultivo '([^']+)' no soportado/i);
    if (!coincidencia) {
      return null;
    }
    const nombre = coincidencia[1].trim();
    return nombre.charAt(0).toUpperCase() + nombre.slice(1);
  }

  private respuesta_http(
    error: unknown,
  ): { status: number; data?: unknown } | undefined {
    if (typeof error !== 'object' || error === null || !('response' in error)) {
      return undefined;
    }
    const response = (error as { response?: { status?: number; data?: unknown } })
      .response;
    if (!response || typeof response.status !== 'number') {
      return undefined;
    }
    return response as { status: number; data?: unknown };
  }
}
