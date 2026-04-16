import { Module } from '@nestjs/common'
import { ConfigModule } from '@nestjs/config'
import { ScheduleModule } from '@nestjs/schedule'
import { AuthModule }          from './features/auth/auth.module'
import { AgentsModule }        from './features/agents/agents.module'
import { MetricsModule }       from './features/metrics/metrics.module'
import { PlaygroundModule }    from './features/playground/playground.module'
import { BroadcastModule }     from './features/broadcast/broadcast.module'
import { ChannelsModule }      from './features/channels/channels.module'
import { UsersModule }         from './features/users/users.module'
import { ConversationsModule } from './features/conversations/conversations.module'
import { CrmModule }           from './features/crm/crm.module'
import { SettingsModule }          from './features/settings/settings.module'
import { WebhookIngestionModule } from './features/webhook-ingestion/webhook-ingestion.module'
import { ContactsModule }         from './features/contacts/contacts.module'
import { AutomationsModule }      from './features/automations/automations.module'
import { ChatIaModule }           from './features/chat-ia/chat-ia.module'
import { VendedorModule }         from './features/vendedor/vendedor.module'
import { InsightsModule }         from './features/insights/insights.module'
import { CampaignsModule }         from './features/campaigns/campaigns.module'
import { DispatchModule }          from './features/dispatch/dispatch.module'
import { FollowUpModule }          from './features/follow-up/follow-up.module'
import { GoogleCalendarModule }     from './infrastructure/google-calendar/google-calendar.module'
import { RemindersModule }          from './features/reminders/reminders.module'
import { GoogleCalendarController } from './presentation/integrations/google-calendar.controller'
import { PrismaModule }           from './infrastructure/database/prisma/prisma.module'

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true }),
    ScheduleModule.forRoot(),
    PrismaModule,
    AuthModule,
    AgentsModule,
    MetricsModule,
    PlaygroundModule,
    BroadcastModule,
    ChannelsModule,
    UsersModule,
    ConversationsModule,
    CrmModule,
    SettingsModule,
    WebhookIngestionModule,
    ContactsModule,
    AutomationsModule,
    ChatIaModule,
    VendedorModule,
    InsightsModule,
    CampaignsModule,
    DispatchModule,
    FollowUpModule,
    GoogleCalendarModule,
    RemindersModule,
  ],
  controllers: [GoogleCalendarController],
})
export class AppModule {}
