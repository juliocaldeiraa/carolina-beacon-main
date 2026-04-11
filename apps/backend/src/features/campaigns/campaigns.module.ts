import { Module, forwardRef }   from '@nestjs/common'
import { PrismaModule }        from '@/infrastructure/database/prisma/prisma.module'
import { DispatchModule }      from '@/features/dispatch/dispatch.module'
import { AiEngineModule }      from '@/infrastructure/ai-engine/ai-engine.module'
import { ChannelSendModule }   from '@/infrastructure/channel-send/channel-send.module'
import { CampaignsService }    from './campaigns.service'
import { CampaignsController } from './campaigns.controller'
import { LeadsService }        from './leads/leads.service'
import { LeadsController }     from './leads/leads.controller'
import { CampaignInboundService } from './campaign-inbound.service'

@Module({
  imports:     [PrismaModule, forwardRef(() => DispatchModule), AiEngineModule, ChannelSendModule],
  controllers: [CampaignsController, LeadsController],
  providers:   [CampaignsService, LeadsService, CampaignInboundService],
  exports:     [CampaignsService, LeadsService, CampaignInboundService],
})
export class CampaignsModule {}
