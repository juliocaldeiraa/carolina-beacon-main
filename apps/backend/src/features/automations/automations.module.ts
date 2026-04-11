import { Module }              from '@nestjs/common'
import { PrismaModule }        from '@/infrastructure/database/prisma/prisma.module'
import { AiEngineModule }      from '@/infrastructure/ai-engine/ai-engine.module'
import { ChannelSendModule }   from '@/infrastructure/channel-send/channel-send.module'
import { CrmModule }           from '@/features/crm/crm.module'
import { AUTOMATION_REPOSITORY } from '@/core/repositories/IAutomationRepository'
import { AutomationRepository }  from '@/infrastructure/database/repositories/automation.repository'
import { AutomationsService }           from './automations.service'
import { AutomationSchedulerService }   from './automation-scheduler.service'
import { AutomationReplyHandlerService } from './automation-reply-handler.service'
import { ChannelResolverService }        from './channel-resolver.service'
import { ChannelMigrationService }       from './channel-migration.service'
import { AutomationsController } from '@/presentation/automations/automations.controller'

@Module({
  imports: [
    PrismaModule,
    AiEngineModule,
    ChannelSendModule,
    CrmModule,
  ],
  controllers: [AutomationsController],
  providers: [
    { provide: AUTOMATION_REPOSITORY, useClass: AutomationRepository },
    AutomationsService,
    AutomationSchedulerService,
    AutomationReplyHandlerService,
    ChannelResolverService,
    ChannelMigrationService,
  ],
  exports: [AutomationReplyHandlerService, ChannelResolverService],
})
export class AutomationsModule {}
