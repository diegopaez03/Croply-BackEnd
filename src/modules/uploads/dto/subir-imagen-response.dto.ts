import { ApiProperty } from '@nestjs/swagger';

export class SubirImagenResponseDto {
  @ApiProperty({ example: 'Imagen subida correctamente' })
  message: string;

  @ApiProperty({
    example: 'https://res.cloudinary.com/demo/image/upload/v1/croply/tomate.jpg',
  })
  url: string;

  @ApiProperty({ example: 'croply/tomate' })
  public_id: string;
}
