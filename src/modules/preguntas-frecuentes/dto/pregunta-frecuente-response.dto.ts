import { ApiProperty } from '@nestjs/swagger';
import { PageSizePaginationDto } from '../../../common/dto';

export class PreguntaFrecuenteItemDto {
  @ApiProperty({ example: 7 })
  id_pregunta_frecuente: number;

  @ApiProperty({ example: '¿Cómo registro una aplicación de agroquímico?' })
  pregunta: string;

  @ApiProperty({
    example:
      'Ingresá a la sección Agroquímicos y presioná "Registrar Aplicación".',
  })
  respuesta: string;
}

export class ListarPreguntasFrecuentesGestionResponseDto {
  @ApiProperty({ type: [PreguntaFrecuenteItemDto] })
  preguntas_frecuentes: PreguntaFrecuenteItemDto[];

  @ApiProperty({ type: PageSizePaginationDto })
  pagination: PageSizePaginationDto;
}

export class ListarPreguntasFrecuentesResponseDto {
  @ApiProperty({ type: [PreguntaFrecuenteItemDto] })
  preguntas_frecuentes: PreguntaFrecuenteItemDto[];
}

export class CrearPreguntaFrecuenteResponseDto extends PreguntaFrecuenteItemDto {
  @ApiProperty({ example: 'Pregunta frecuente creada correctamente.' })
  message: string;
}

export class ActualizarPreguntaFrecuenteResponseDto extends PreguntaFrecuenteItemDto {
  @ApiProperty({ example: 'Pregunta frecuente actualizada correctamente.' })
  message: string;
}

export class EliminarPreguntaFrecuenteResponseDto {
  @ApiProperty({ example: 'Pregunta frecuente eliminada correctamente.' })
  message: string;

  @ApiProperty({ example: 7 })
  id_pregunta_frecuente: number;
}
