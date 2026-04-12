import { Module }              from '@nestjs/common'
import { AgentsController }    from '../../presentation/agents/agents.controller'
import { AgentsService }       from './agents.service'
import { TrainingsService }    from './trainings.service'
import { TrainingsController } from './trainings.controller'
import { AgentRepository }     from '../../infrastructure/database/repositories/agent.repository'
import { AGENT_REPOSITORY }    from '../../core/repositories/IAgentRepository'
import { AiEngineModule }      from '../../infrastructure/ai-engine/ai-engine.module'
import { PrismaModule }        from '../../infrastructure/database/prisma/prisma.module'

@Module({
  imports:     [AiEngineModule, PrismaModule],
  controllers: [AgentsController, TrainingsController],
  providers: [
    AgentsService,
    TrainingsService,
    { provide: AGENT_REPOSITORY, useClass: AgentRepository },
  ],
  exports: [AgentsService, TrainingsService],
})
export class AgentsModule {}
