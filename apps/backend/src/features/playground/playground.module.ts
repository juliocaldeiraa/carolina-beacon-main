import { Module }                from '@nestjs/common'
import { PlaygroundService }     from './playground.service'
import { PlaygroundController }  from '@/presentation/playground/playground.controller'
import { AiEngineModule }        from '@/infrastructure/ai-engine/ai-engine.module'
import { GoogleCalendarModule }  from '@/infrastructure/google-calendar/google-calendar.module'
import { AgentsModule }          from '@/features/agents/agents.module'
import { AgentRepository }       from '@/infrastructure/database/repositories/agent.repository'
import { AGENT_REPOSITORY }      from '@/core/repositories/IAgentRepository'

@Module({
  imports:     [AiEngineModule, GoogleCalendarModule, AgentsModule],
  controllers: [PlaygroundController],
  providers: [
    PlaygroundService,
    { provide: AGENT_REPOSITORY, useClass: AgentRepository },
  ],
})
export class PlaygroundModule {}
