import {
  Controller,
  Post,
  UploadedFile,
  UseGuards,
  UseInterceptors,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import {
  ApiBody,
  ApiConsumes,
  ApiCreatedResponse,
  ApiOperation,
  ApiTags,
} from '@nestjs/swagger';
import { memoryStorage } from 'multer';
import { ApiAuth, ApiErrorResponses } from '../../common/decorators';
import { SWAGGER_TAGS } from '../../common/swagger';
import { JwtAuthGuard } from '../auth';
import { SubirImagenResponseDto } from './dto/subir-imagen-response.dto';
import { IMAGEN_MAX_BYTES } from './uploads.constants';
import { UploadsService } from './uploads.service';

@ApiTags(SWAGGER_TAGS.UPLOADS)
@Controller('uploads')
export class UploadsController {
  constructor(private readonly uploads_service: UploadsService) {}

  @Post('imagenes')
  @UseGuards(JwtAuthGuard)
  @UseInterceptors(
    FileInterceptor('archivo', {
      storage: memoryStorage(),
      limits: { fileSize: IMAGEN_MAX_BYTES },
    }),
  )
  @ApiAuth()
  @ApiConsumes('multipart/form-data')
  @ApiOperation({ summary: 'Subir una imagen a Cloudinary' })
  @ApiBody({
    schema: {
      type: 'object',
      required: ['archivo'],
      properties: {
        archivo: {
          type: 'string',
          format: 'binary',
          description: 'Imagen JPEG, PNG o WebP (máx. 5 MB)',
        },
      },
    },
  })
  @ApiCreatedResponse({
    description: 'Imagen subida',
    type: SubirImagenResponseDto,
  })
  @ApiErrorResponses({ badRequest: true })
  subir_imagen(@UploadedFile() archivo?: Express.Multer.File) {
    return this.uploads_service.subir_imagen(archivo);
  }
}
