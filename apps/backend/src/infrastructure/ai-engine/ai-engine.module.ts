import { Module }                 from '@nestjs/common'
import { PrismaModule }           from '@/infrastructure/database/prisma/prisma.module'
import { AiEngineService }        from './ai-engine.service'
import { MessageSplitterService } from './message-splitter.service'

@Module({
  imports:   [PrismaModule],
  providers: [AiEngineService, MessageSplitterService],
  exports:   [AiEngineService, MessageSplitterService],
})
export class AiEngineModule {}
