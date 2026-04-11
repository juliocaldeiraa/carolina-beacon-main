import { Module } from '@nestjs/common'
import { PrismaModule } from '@/infrastructure/database/prisma/prisma.module'
import { ChannelsController } from '@/presentation/channels/channels.controller'
import { ChannelsService } from './channels.service'
import { ChannelPollerService } from './channel-poller.service'
import { ChannelRepository } from '@/infrastructure/database/repositories/channel.repository'
import { CHANNEL_REPOSITORY } from '@/core/repositories/IChannelRepository'

@Module({
  imports: [PrismaModule],
  controllers: [ChannelsController],
  providers: [
    ChannelsService,
    ChannelPollerService,
    { provide: CHANNEL_REPOSITORY, useClass: ChannelRepository },
  ],
})
export class ChannelsModule {}
