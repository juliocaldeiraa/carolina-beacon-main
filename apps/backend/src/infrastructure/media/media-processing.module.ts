import { Module } from '@nestjs/common'
import { MediaProcessingService } from './media-processing.service'
import { PrismaModule } from '../database/prisma/prisma.module'

@Module({
  imports:   [PrismaModule],
  providers: [MediaProcessingService],
  exports:   [MediaProcessingService],
})
export class MediaProcessingModule {}
