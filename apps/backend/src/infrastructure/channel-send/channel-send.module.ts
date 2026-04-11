import { Module }             from '@nestjs/common'
import { ChannelSendService } from './channel-send.service'

@Module({
  providers: [ChannelSendService],
  exports:   [ChannelSendService],
})
export class ChannelSendModule {}
