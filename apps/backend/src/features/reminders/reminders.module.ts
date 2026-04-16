import { Module } from '@nestjs/common'
import { ReminderService } from './reminder.service'
import { PrismaModule } from '@/infrastructure/database/prisma/prisma.module'
import { ChannelSendModule } from '@/infrastructure/channel-send/channel-send.module'
import { GoogleCalendarModule } from '@/infrastructure/google-calendar/google-calendar.module'
import { AiEngineModule } from '@/infrastructure/ai-engine/ai-engine.module'

@Module({
  imports: [PrismaModule, ChannelSendModule, GoogleCalendarModule, AiEngineModule],
  providers: [ReminderService],
  exports: [ReminderService],
})
export class RemindersModule {}
