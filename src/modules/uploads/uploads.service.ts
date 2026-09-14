import { Injectable, Logger } from '@nestjs/common';
import { CloudinaryService } from '../../common/cloudinary';
import {
  invalidFileType,
  requiredField,
  unexpectedError,
  fileTooLarge,
} from '../../common/exceptions';
import {
  IMAGEN_MAX_BYTES,
  IMAGEN_MAX_MB,
  IMAGEN_MIME_TYPES_PERMITIDOS,
} from './uploads.constants';
import { SubirImagenResponseDto } from './dto/subir-imagen-response.dto';

@Injectable()
export class UploadsService {
  private readonly logger = new Logger(UploadsService.name);

  constructor(private readonly cloudinary: CloudinaryService) {}

  async subir_imagen(
    archivo?: Express.Multer.File,
  ): Promise<SubirImagenResponseDto> {
    if (!archivo) {
      throw requiredField('archivo');
    }

    if (
      !(IMAGEN_MIME_TYPES_PERMITIDOS as readonly string[]).includes(
        archivo.mimetype,
      )
    ) {
      throw invalidFileType([...IMAGEN_MIME_TYPES_PERMITIDOS]);
    }

    if (archivo.size > IMAGEN_MAX_BYTES) {
      throw fileTooLarge(IMAGEN_MAX_MB);
    }

    try {
      const result = await this.cloudinary.subir_imagen(archivo.buffer);
      return {
        message: 'Imagen subida correctamente',
        url: result.url,
        public_id: result.public_id,
      };
    } catch (error) {
      this.logger.error(
        error instanceof Error ? error.stack : String(error),
      );
      throw unexpectedError();
    }
  }
}
