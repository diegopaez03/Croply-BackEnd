import { ApiProperty } from '@nestjs/swagger';

/**
 * Response payload for the health check endpoint.
 * Serves as the reference example for documenting feature DTOs.
 */
export class HealthResponseDto {
  @ApiProperty({
    description: 'Estado general del servicio',
    example: 'ok',
    enum: ['ok', 'degraded', 'error'],
  })
  status: 'ok' | 'degraded' | 'error';

  @ApiProperty({
    description: 'Nombre del servicio',
    example: 'croply-backend',
  })
  service: string;

  @ApiProperty({
    description: 'Versión de la API',
    example: '0.1.0',
  })
  version: string;

  @ApiProperty({
    description: 'Entorno de ejecución',
    example: 'development',
  })
  environment: string;

  @ApiProperty({
    description: 'Timestamp ISO 8601 de la verificación',
    example: '2026-07-20T15:30:00.000Z',
  })
  timestamp: string;

  @ApiProperty({
    description: 'Tiempo en ejecución del proceso (segundos)',
    example: 128.45,
  })
  uptime: number;
}
