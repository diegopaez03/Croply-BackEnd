import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { UploadApiErrorResponse, UploadApiResponse, v2 as cloudinary } from 'cloudinary';
import { Readable } from 'stream';

export interface CloudinaryUploadResult {
  url: string;
  public_id: string;
}

@Injectable()
export class CloudinaryService {
  constructor(private readonly config: ConfigService) {
    cloudinary.config({
      cloud_name: this.config.get<string>('CLOUDINARY_CLOUD_NAME'),
      api_key: this.config.get<string>('CLOUDINARY_API_KEY'),
      api_secret: this.config.get<string>('CLOUDINARY_API_SECRET'),
    });
  }

  async subir_imagen(
    buffer: Buffer,
    opciones?: { folder?: string },
  ): Promise<CloudinaryUploadResult> {
    const folder =
      opciones?.folder ??
      this.config.get<string>('CLOUDINARY_UPLOAD_FOLDER', 'croply');

    const result = await this.upload_buffer(buffer, folder);
    return {
      url: result.secure_url,
      public_id: result.public_id,
    };
  }

  private upload_buffer(
    buffer: Buffer,
    folder: string,
  ): Promise<UploadApiResponse> {
    return new Promise((resolve, reject) => {
      const stream = cloudinary.uploader.upload_stream(
        { folder, resource_type: 'image' },
        (
          error: UploadApiErrorResponse | undefined,
          result: UploadApiResponse | undefined,
        ) => {
          if (error || !result) {
            reject(error ?? new Error('Cloudinary no devolvió resultado'));
            return;
          }
          resolve(result);
        },
      );
      Readable.from(buffer).pipe(stream);
    });
  }
}
