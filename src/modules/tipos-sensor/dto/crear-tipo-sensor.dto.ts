import { ApiProperty } from '@nestjs/swagger';
import { IsEnum, IsNotEmpty, IsString } from 'class-validator';
import { CodigoTipoSensor } from '../enums/codigo-tipo-sensor.enum';

export class CrearTipoSensorDto {
  @ApiProperty({ enum: CodigoTipoSensor })
  @IsEnum(CodigoTipoSensor)
  codigo_tipo_sensor: CodigoTipoSensor;

  @ApiProperty()
  @IsString()
  @IsNotEmpty()
  nombre_tipo_sensor: string;

  @ApiProperty()
  @IsString()
  @IsNotEmpty()
  unidad_medida_ts: string;
}
