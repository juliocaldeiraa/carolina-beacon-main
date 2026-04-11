import { Module }          from '@nestjs/common'
import { PrismaModule }    from '@/infrastructure/database/prisma/prisma.module'
import { DispatchModule }  from '@/features/dispatch/dispatch.module'
import { FollowUpService } from './follow-up.service'
import { FollowUpController } from './follow-up.controller'

@Module({
  imports:     [PrismaModule, DispatchModule],
  controllers: [FollowUpController],
  providers:   [FollowUpService],
  exports:     [FollowUpService],
})
export class FollowUpModule {}
