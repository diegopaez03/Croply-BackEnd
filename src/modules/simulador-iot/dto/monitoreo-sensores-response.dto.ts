import { ApiProperty } from '@nestjs/swagger';
import { EstadoTransmision } from '../../../common/enums';

export class SensorMonitoreoResponseDto {
  @ApiProperty({
    description: 'Identificador del controlador al que pertenece el sensor',
    example: 8,
  })
  id_controlador_sensor: number;

  @ApiProperty({
    description: 'Nombre del controlador al que pertenece el sensor',
    example: 'Controlador Norte',
  })
  nombre_controlador: string;

  @ApiProperty({ description: 'Identificador del sensor', example: 501 })
  id_sensor: number;

  @ApiProperty({
    description: 'Nombre del tipo de sensor',
    example: 'Sensor de pH',
  })
  nombre_tipo_sensor: string;

  @ApiProperty({
    description: 'Unidad de medida del tipo de sensor',
    example: 'pH',
  })
  unidad_medida_ts: string;

  @ApiProperty({
    description: 'Último valor persistido. Se conserva aunque el sensor esté sin señal',
    example: 6.45,
    nullable: true,
  })
  ultimo_valor: number | null;

  @ApiProperty({
    description: 'Fecha de la última lectura persistida',
    example: '2026-09-07T20:31:08.461Z',
    nullable: true,
  })
  fecha_ultima_lectura: Date | null;

  @ApiProperty({
    description: 'Estado de transmisión calculado por Croply',
    enum: EstadoTransmision,
    example: EstadoTransmision.TRANSMITIENDO,
  })
  estado_senal: EstadoTransmision;
}

export class MonitoreoSensoresResponseDto {
  @ApiProperty({
    description:
      'Transmitiendo si al menos un sensor transmite; Sin_senal si todos están sin señal; null si la parcela no tiene sensores',
    enum: EstadoTransmision,
    example: EstadoTransmision.TRANSMITIENDO,
    nullable: true,
  })
  estado_general: EstadoTransmision | null;

  @ApiProperty({ type: [SensorMonitoreoResponseDto] })
  sensores: SensorMonitoreoResponseDto[];
}
