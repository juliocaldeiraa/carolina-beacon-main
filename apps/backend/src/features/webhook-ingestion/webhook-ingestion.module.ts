import { Module }                    from '@nestjs/common'
import { PrismaModule }              from '@/infrastructure/database/prisma/prisma.module'
import { AiEngineModule }            from '@/infrastructure/ai-engine/ai-engine.module'
import { ChannelSendModule }         from '@/infrastructure/channel-send/channel-send.module'
import { GoogleCalendarModule }      from '@/infrastructure/google-calendar/google-calendar.module'
import { ContactsModule }            from '@/features/contacts/contacts.module'
import { AutomationsModule }         from '@/features/automations/automations.module'
import { CampaignsModule }          from '@/features/campaigns/campaigns.module'
import { AgentsModule }             from '@/features/agents/agents.module'
import { WebhookIngestionService }   from './webhook-ingestion.service'
import { WebhookIngestionController } from '@/presentation/webhook-ingestion/webhook-ingestion.controller'

@Module({
  imports: [
    PrismaModule,
    AiEngineModule,
    ChannelSendModule,
    GoogleCalendarModule,
    ContactsModule,
    AutomationsModule,
    CampaignsModule,
    AgentsModule,
  ],
  controllers: [WebhookIngestionController],
  providers:   [WebhookIngestionService],
})
export class WebhookIngestionModule {}
