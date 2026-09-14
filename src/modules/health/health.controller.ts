import { Controller, Get } from '@nestjs/common';
import {
  ApiOkResponse,
  ApiOperation,
  ApiTags,
} from '@nestjs/swagger';
import { SWAGGER_TAGS } from '../../common/swagger';
import { ApiErrorResponses } from '../../common/decorators';
import { HealthResponseDto } from './dto/health-response.dto';
import { HealthService } from './health.service';

@ApiTags(SWAGGER_TAGS.HEALTH)
@Controller('health')
export class HealthController {
  constructor(private readonly healthService: HealthService) {}

  @Get()
  @ApiOperation({
    summary: 'Health check',
    description:
      'Verifica que la API esté operativa. No requiere autenticación. ' +
      'Útil para probes de orquestadores (Docker, Kubernetes, load balancers).',
  })
  @ApiOkResponse({
    description: 'Servicio operativo',
    type: HealthResponseDto,
  })
  @ApiErrorResponses({
    unauthorized: false,
    badRequest: false,
    tooManyRequests: true,
    internalServerError: true,
  })
  check(): HealthResponseDto {
    return this.healthService.check();
  }
}
