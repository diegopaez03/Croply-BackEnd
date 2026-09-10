import { HttpStatus } from '@nestjs/common';
import { CloudinaryService } from '../../common/cloudinary';
import { UploadsService } from './uploads.service';

function archivo_valido(
  overrides: Partial<Express.Multer.File> = {},
): Express.Multer.File {
  return {
    fieldname: 'archivo',
    originalname: 'tomate.jpg',
    encoding: '7bit',
    mimetype: 'image/jpeg',
    size: 1024,
    buffer: Buffer.from('fake-image'),
    destination: '',
    filename: '',
    path: '',
    stream: undefined as never,
    ...overrides,
  };
}

describe('UploadsService', () => {
  let service: UploadsService;
  let cloudinary: { subir_imagen: jest.Mock };

  beforeEach(() => {
    cloudinary = {
      subir_imagen: jest.fn().mockResolvedValue({
        url: 'https://res.cloudinary.com/demo/image.jpg',
        public_id: 'croply/tomate',
      }),
    };
    service = new UploadsService(cloudinary as unknown as CloudinaryService);
  });

  it('sube una imagen válida y devuelve url y public_id', async () => {
    const result = await service.subir_imagen(archivo_valido());

    expect(result.message).toBe('Imagen subida correctamente');
    expect(result.url).toBe('https://res.cloudinary.com/demo/image.jpg');
    expect(result.public_id).toBe('croply/tomate');
  });

  it('exige el archivo', async () => {
    await expect(service.subir_imagen(undefined)).rejects.toMatchObject({
      errorCode: 'REQUIRED_FIELD',
      status: HttpStatus.BAD_REQUEST,
    });
  });

  it('rechaza un tipo no permitido', async () => {
    await expect(
      service.subir_imagen(archivo_valido({ mimetype: 'application/pdf' })),
    ).rejects.toMatchObject({
      errorCode: 'INVALID_FILE_TYPE',
      status: HttpStatus.BAD_REQUEST,
    });
  });

  it('rechaza un archivo demasiado grande', async () => {
    await expect(
      service.subir_imagen(archivo_valido({ size: 6 * 1024 * 1024 })),
    ).rejects.toMatchObject({
      errorCode: 'FILE_TOO_LARGE',
      status: HttpStatus.BAD_REQUEST,
    });
  });

  it('traduce fallos de Cloudinary a UNEXPECTED_ERROR', async () => {
    cloudinary.subir_imagen.mockRejectedValue(new Error('timeout'));

    await expect(service.subir_imagen(archivo_valido())).rejects.toMatchObject({
      errorCode: 'UNEXPECTED_ERROR',
      status: HttpStatus.INTERNAL_SERVER_ERROR,
    });
  });
});
