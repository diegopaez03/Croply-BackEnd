import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { HealthResponseDto } from './dto/health-response.dto';

@Injectable()
export class HealthService {
  constructor(private readonly config: ConfigService) {}

  check(): HealthResponseDto {
    return {
      status: 'ok',
      service: 'croply-backend',
      version: '0.1.0',
      environment: this.config.get<string>('NODE_ENV', 'development'),
      timestamp: new Date().toISOString(),
      uptime: process.uptime(),
    };
  }
}
