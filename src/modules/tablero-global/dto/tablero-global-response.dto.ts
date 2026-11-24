import { ApiProperty } from '@nestjs/swagger';

export class TableroClientesDto {
  @ApiProperty({
    description:
      'Usuarios no dados de baja con un vínculo ADMIN_FINCA vigente sobre una finca activa',
    example: 128,
  })
  total: number;

  @ApiProperty({
    description:
      'Clientes cuyo primer vínculo ADMIN_FINCA cae en el mes calendario actual (America/Argentina/Buenos_Aires)',
    example: 7,
  })
  nuevos_este_mes: number;
}

export class TableroSensoresDto {
  @ApiProperty({
    description: 'Sensores vivos transmitiendo (mismo valor que total_activos)',
    example: 23030,
  })
  activos: number;

  @ApiProperty({
    description:
      'total_activos / (total_activos + total_inactivos) * 100, redondeado a 1 decimal. 0 si no hay sensores',
    example: 92.4,
  })
  porcentaje_parque_total: number;

  @ApiProperty({
    description: 'Sensores vivos con estado_senal = Transmitiendo',
    example: 23030,
  })
  total_activos: number;

  @ApiProperty({
    description: 'Sensores vivos con estado_senal = Sin_senal',
    example: 1894,
  })
  total_inactivos: number;
}

export class TableroHectareasDto {
  @ApiProperty({
    description: 'Suma de superficie_finca de las fincas activas',
    example: 15420.5,
  })
  total: number;

  @ApiProperty({
    description:
      'Provincias distintas (normalizadas con LOWER/TRIM) entre las fincas activas',
    example: 9,
  })
  provincias: number;
}

export class TableroEvolucionFincasDto {
  @ApiProperty({ description: 'Mes en formato YYYY-MM', example: '2026-05' })
  mes: string;

  @ApiProperty({ description: 'Fincas dadas de alta en el mes', example: 4 })
  nuevas_fincas: number;
}

export class TableroGlobalResponseDto {
  @ApiProperty({ type: TableroClientesDto })
  clientes: TableroClientesDto;

  @ApiProperty({ type: TableroSensoresDto })
  sensores: TableroSensoresDto;

  @ApiProperty({ type: TableroHectareasDto })
  hectareas: TableroHectareasDto;

  @ApiProperty({
    type: [TableroEvolucionFincasDto],
    description:
      'Altas de fincas de los últimos 6 meses (incluye el actual), orden ascendente',
  })
  evolucion_fincas: TableroEvolucionFincasDto[];
}
