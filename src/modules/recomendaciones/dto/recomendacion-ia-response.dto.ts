import { ApiProperty } from '@nestjs/swagger';

export type OrigenDatos =
  | 'CACHE_VIGENTE'
  | 'CACHE_RENOVADA_SIN_LLM'
  | 'NUEVA_EVALUACION_LLM'
  | 'FALLBACK_INTA';

export class FactorClaveDto {
  @ApiProperty()
  sensor_ui: string;

  @ApiProperty({ nullable: true })
  valor: number | null;
}

export class RecomendacionIaResponseDto {
  @ApiProperty()
  id_recomendacion: number;

  @ApiProperty()
  id_parcela: number;

  @ApiProperty({ example: 'REGAR_URGENTE' })
  accion_recomendada: string;

  @ApiProperty({ example: 'Alta' })
  severidad: string;

  @ApiProperty()
  sensor_origen_principal: string;

  @ApiProperty({ type: [FactorClaveDto] })
  factores_clave: FactorClaveDto[];

  @ApiProperty({ nullable: true })
  titulo_corto: string | null;

  @ApiProperty({ nullable: true })
  texto_breve: string | null;

  @ApiProperty({ nullable: true })
  texto_explicativo_extendido: string | null;

  @ApiProperty()
  fecha_generacion: string;

  @ApiProperty()
  valida_hasta: string;

  @ApiProperty({
    enum: [
      'CACHE_VIGENTE',
      'CACHE_RENOVADA_SIN_LLM',
      'NUEVA_EVALUACION_LLM',
      'FALLBACK_INTA',
    ],
  })
  origen_datos: OrigenDatos;
}
