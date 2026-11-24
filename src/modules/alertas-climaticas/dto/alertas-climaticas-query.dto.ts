import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsEnum, IsOptional } from 'class-validator';
import { EstadoAlertaClimatica } from '../enums/estado-alerta-climatica.enum';

export class AlertasClimaticasQueryDto {
  @ApiPropertyOptional({
    enum: EstadoAlertaClimatica,
    default: EstadoAlertaClimatica.VIGENTE,
  })
  @IsOptional()
  @IsEnum(EstadoAlertaClimatica)
  estado?: EstadoAlertaClimatica;
}
