import { Module }                    from '@nestjs/common'
import { BroadcastController }       from '@/presentation/broadcast/broadcast.controller'
import { BroadcastService }          from './broadcast.service'
import { BroadcastQueueService }     from './broadcast-queue.service'
import { BroadcastProcessorService } from './broadcast-processor.service'
import { BroadcastRepository }       from '@/infrastructure/database/repositories/broadcast.repository'
import { BROADCAST_REPOSITORY }      from '@/core/repositories/IBroadcastRepository'
import { ChannelSendModule }         from '@/infrastructure/channel-send/channel-send.module'
import { PrismaModule }              from '@/infrastructure/database/prisma/prisma.module'

@Module({
  imports: [PrismaModule, ChannelSendModule],
  controllers: [BroadcastController],
  providers: [
    BroadcastService,
    BroadcastQueueService,
    BroadcastProcessorService,
    { provide: BROADCAST_REPOSITORY, useClass: BroadcastRepository },
  ],
})
export class BroadcastModule {}
