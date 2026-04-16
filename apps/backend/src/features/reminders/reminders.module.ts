import { Module } from '@nestjs/common'
import { ReminderService } from './reminder.service'
import { PrismaModule } from '@/infrastructure/database/prisma/prisma.module'
import { ChannelSendModule } from '@/infrastructure/channel-send/channel-send.module'

@Module({
  imports: [PrismaModule, ChannelSendModule],
  providers: [ReminderService],
})
export class RemindersModule {}
