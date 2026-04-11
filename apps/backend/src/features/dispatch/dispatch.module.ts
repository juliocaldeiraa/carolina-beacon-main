import { Module, forwardRef }   from '@nestjs/common'
import { PrismaModule }         from '@/infrastructure/database/prisma/prisma.module'
import { ChannelSendModule }    from '@/infrastructure/channel-send/channel-send.module'
import { CampaignsModule }      from '@/features/campaigns/campaigns.module'
import { DispatchService }      from './dispatch.service'
import { DispatchProcessor }    from './dispatch.processor'
import { DispatchQueueService } from './dispatch-queue.service'

@Module({
  imports:   [PrismaModule, ChannelSendModule, forwardRef(() => CampaignsModule)],
  providers: [DispatchService, DispatchQueueService, DispatchProcessor],
  exports:   [DispatchService, DispatchQueueService],
})
export class DispatchModule {}
