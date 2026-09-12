import { Injectable } from '@nestjs/common';
import { HttpService } from '@nestjs/axios';
import { ConfigService } from '@nestjs/config';
import { Parcela } from '../parcelas/entities/parcela.entity';
import { EstadoTransmision } from '../../common/enums';

export interface ParcelaSimuladorDto {
  parcela: {
    id: number;
    nombre: string;
    latitud: number;
    longitud: number;
    controladores: Array<{
      id: number;
      ip?: string | null;
      estado: 'TRANSMITIENDO' | 'SIN_SEÑAL';
      sensores: Array<{ id: number; tipo: string }>;
    }>;
  };
}

@Injectable()
export class SimuladorSincronizacionEstructuralService {
  private readonly max_reintentos = 3;

  constructor(
    private readonly http: HttpService,
    private readonly config: ConfigService,
  ) {}

  async sincronizar_creacion(parcela: Parcela): Promise<void> {
    await this.request_with_retries(() =>
      this.http.axiosRef.post('/parcelas', this.build_body(parcela)),
    );
  }

  async sincronizar_actualizacion(parcela: Parcela): Promise<void> {
    await this.request_with_retries(() =>
      this.http.axiosRef.put(
        `/parcelas/${Number(parcela.id_parcela)}`,
        this.build_body(parcela),
      ),
    );
  }

  async sincronizar_baja(parcela: Parcela): Promise<void> {
    await this.request_with_retries(() =>
      this.http.axiosRef.delete(`/parcelas/${Number(parcela.id_parcela)}`),
    );
  }

  private build_body(parcela: Parcela): ParcelaSimuladorDto {
    return {
      parcela: {
        id: Number(parcela.id_parcela),
        nombre: parcela.nombre_parcela,
        latitud: parseFloat(parcela.finca.latitud),
        longitud: parseFloat(parcela.finca.longitud),
        controladores: (parcela.controladores ?? [])
          .filter((controlador) => controlador.fecha_baja == null)
          .map((controlador) => ({
            id: Number(controlador.id_controlador_sensor),
            ip: controlador.ip_controlador,
            estado: this.map_estado(controlador.estado_controlador),
            sensores: (controlador.sensores ?? [])
              .filter((sensor) => sensor.fecha_baja == null)
              .map((sensor) => ({
                id: Number(sensor.id_sensor),
                tipo: sensor.tipo_sensor.codigo_tipo_sensor,
              })),
          })),
      },
    };
  }

  private map_estado(
    estado: EstadoTransmision,
  ): 'TRANSMITIENDO' | 'SIN_SEÑAL' {
    return estado === EstadoTransmision.TRANSMITIENDO
      ? 'TRANSMITIENDO'
      : 'SIN_SEÑAL';
  }

  private async request_with_retries(
    request: () => Promise<unknown>,
  ): Promise<void> {
    let ultimo_error: unknown;
    for (let intento = 0; intento <= this.max_reintentos; intento += 1) {
      try {
        await request();
        return;
      } catch (error) {
        ultimo_error = error;
      }
    }
    throw ultimo_error;
  }
}
