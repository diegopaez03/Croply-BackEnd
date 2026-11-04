import { ApiProperty } from '@nestjs/swagger';
import { Transform } from 'class-transformer';
import { IsNotEmpty, IsString, MaxLength } from 'class-validator';

const trim = ({ value }: { value: unknown }) =>
  typeof value === 'string' ? value.trim() : value;

export class CrearPreguntaFrecuenteDto {
  @ApiProperty({
    description: 'Texto de la pregunta (texto plano, se recortan los espacios de los extremos)',
    example: '¿Cómo registro una aplicación de agroquímico?',
    maxLength: 255,
  })
  @Transform(trim)
  @IsString()
  @IsNotEmpty()
  @MaxLength(255)
  pregunta: string;

  @ApiProperty({
    description: 'Respuesta (texto plano, se conservan los saltos de línea)',
    example:
      'Ingresá a la sección Agroquímicos y presioná "Registrar Aplicación".',
    maxLength: 2000,
  })
  @Transform(trim)
  @IsString()
  @IsNotEmpty()
  @MaxLength(2000)
  respuesta: string;
}
