import { Module }                    from '@nestjs/common'
import { PrismaModule }              from '@/infrastructure/database/prisma/prisma.module'
import { AiEngineModule }            from '@/infrastructure/ai-engine/ai-engine.module'
import { ChannelSendModule }         from '@/infrastructure/channel-send/channel-send.module'
import { ContactsModule }            from '@/features/contacts/contacts.module'
import { AutomationsModule }         from '@/features/automations/automations.module'
import { CampaignsModule }          from '@/features/campaigns/campaigns.module'
import { WebhookIngestionService }   from './webhook-ingestion.service'
import { WebhookIngestionController } from '@/presentation/webhook-ingestion/webhook-ingestion.controller'

@Module({
  imports: [
    PrismaModule,
    AiEngineModule,
    ChannelSendModule,
    ContactsModule,
    AutomationsModule,
    CampaignsModule,
  ],
  controllers: [WebhookIngestionController],
  providers:   [WebhookIngestionService],
})
export class WebhookIngestionModule {}
