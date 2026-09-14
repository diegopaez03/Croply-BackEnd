import { Module } from '@nestjs/common';
import { CloudinaryModule } from '../../common/cloudinary';
import { AuthModule } from '../auth';
import { UploadsController } from './uploads.controller';
import { UploadsService } from './uploads.service';

@Module({
  imports: [CloudinaryModule, AuthModule],
  controllers: [UploadsController],
  providers: [UploadsService],
  exports: [UploadsService],
})
export class UploadsModule {}
