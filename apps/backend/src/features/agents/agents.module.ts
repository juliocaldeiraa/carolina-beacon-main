import { Module }           from '@nestjs/common'
import { AgentsController } from '../../presentation/agents/agents.controller'
import { AgentsService }    from './agents.service'
import { AgentRepository }  from '../../infrastructure/database/repositories/agent.repository'
import { AGENT_REPOSITORY } from '../../core/repositories/IAgentRepository'
import { AiEngineModule }   from '../../infrastructure/ai-engine/ai-engine.module'

@Module({
  imports:     [AiEngineModule],
  controllers: [AgentsController],
  providers: [
    AgentsService,
    { provide: AGENT_REPOSITORY, useClass: AgentRepository },
  ],
  exports: [AgentsService],
})
export class AgentsModule {}
