import { ApiProperty } from '@nestjs/swagger';
import { EstadoAlertaClimatica } from '../enums/estado-alerta-climatica.enum';

export class AlertaClimaticaResponseDto {
  @ApiProperty()
  id_alerta: number;

  @ApiProperty({ example: 'ALERTA_HELADA' })
  codigo_alerta: string;

  @ApiProperty({ example: 'Alta' })
  severidad: string;

  @ApiProperty()
  fecha_deteccion: string;

  @ApiProperty()
  descripcion: string;

  @ApiProperty({ enum: EstadoAlertaClimatica })
  estado: EstadoAlertaClimatica;
}

export class ListadoAlertasClimaticasResponseDto {
  @ApiProperty({ type: [AlertaClimaticaResponseDto] })
  alertas: AlertaClimaticaResponseDto[];
}
