import {
  Controller, Get, Post, Patch, Delete,
  Body, Param, Query, UseGuards, Req,
} from '@nestjs/common'
import {
  IsString, IsOptional, IsEnum, IsIn, MinLength,
  IsArray, IsNumber, IsBoolean, Min, Max,
} from 'class-validator'
import { AgentsService } from '../../features/agents/agents.service'
import { AgentRefineService } from '../../features/agents/agent-refine.service'
import { JwtGuard } from '../../shared/guards/jwt.guard'
import { AgentStatus, AgentType } from '../../core/entities/Agent'

// =============================================
// DTOs
// =============================================

const DEFAULT_AGENT_MODEL = 'gpt-5.4-nano'

class CreateAgentDto {
  @IsString()
  @MinLength(2)
  name!: string

  @IsOptional()
  @IsString()
  description?: string

  @IsOptional()
  @IsString()
  model?: string

  @IsOptional()
  @IsString()
  systemPrompt?: string

  @IsOptional()
  @IsString()
  personality?: string

  @IsOptional()
  @IsString()
  actionPrompt?: string

  @IsOptional()
  @IsNumber()
  @Min(0)
  @Max(1)
  temperature?: number

  @IsOptional()
  @IsNumber()
  @Min(50)
  @Max(2000)
  maxTokens?: number

  @IsOptional()
  @IsBoolean()
  limitTurns?: boolean

  @IsOptional()
  @IsNumber()
  @Min(2)
  @Max(50)
  maxTurns?: number

  @IsOptional()
  @IsBoolean()
  fallbackEnabled?: boolean

  @IsOptional()
  @IsString()
  fallbackMessage?: string

  @IsOptional()
  @IsArray()
  tools?: string[]

  @IsOptional()
  @IsString()
  channelId?: string

  @IsOptional()
  @IsNumber()
  @Min(5)
  @Max(100)
  historyLimit?: number

  @IsOptional()
  @IsEnum(['ATIVO', 'PASSIVO'])
  agentType?: AgentType

  @IsOptional() @IsBoolean() useEmojis?: boolean
  @IsOptional() @IsBoolean() splitResponse?: boolean
  @IsOptional() @IsBoolean() restrictTopics?: boolean
  @IsOptional() @IsBoolean() signName?: boolean
  @IsOptional() @IsString()  communicationTone?: string
  @IsOptional() @IsNumber()  inactivityMinutes?: number
  @IsOptional() @IsString()  inactivityAction?: string
  @IsOptional() @IsIn(['qualification', 'qualification_scheduling', 'qualification_scheduling_reminder', 'sales', 'support', 'reception', 'reactivation', 'survey'])
  purpose?: string
  @IsOptional() @IsString()  companyName?: string
  @IsOptional() @IsString()  companyUrl?: string
  @IsOptional() @IsString()  conversationFlow?: string
  @IsOptional() @IsBoolean() leadDispatchEnabled?: boolean
  @IsOptional() @IsString()  leadDispatchPhone?: string
  @IsOptional() @IsBoolean() reminderEnabled?: boolean
  @IsOptional() @IsNumber()  reminderMinutes?: number
  @IsOptional() @IsString()  reminderMessage?: string
}

class UpdateAgentDto {
  @IsOptional()
  @IsString()
  @MinLength(2)
  name?: string

  @IsOptional()
  @IsString()
  description?: string

  @IsOptional()
  @IsString()
  model?: string

  @IsOptional()
  @IsString()
  systemPrompt?: string

  @IsOptional()
  @IsString()
  personality?: string

  @IsOptional()
  @IsString()
  actionPrompt?: string

  @IsOptional()
  @IsNumber()
  @Min(0)
  @Max(1)
  temperature?: number

  @IsOptional()
  @IsNumber()
  @Min(50)
  @Max(2000)
  maxTokens?: number

  @IsOptional()
  @IsBoolean()
  limitTurns?: boolean

  @IsOptional()
  @IsNumber()
  @Min(2)
  @Max(50)
  maxTurns?: number

  @IsOptional()
  @IsBoolean()
  fallbackEnabled?: boolean

  @IsOptional()
  @IsString()
  fallbackMessage?: string

  @IsOptional()
  @IsArray()
  tools?: string[]

  @IsOptional()
  @IsString()
  channelId?: string

  @IsOptional()
  @IsNumber()
  @Min(5)
  @Max(100)
  historyLimit?: number

  @IsOptional()
  @IsEnum(['ATIVO', 'PASSIVO'])
  agentType?: AgentType

  @IsOptional() @IsBoolean() useEmojis?: boolean
  @IsOptional() @IsBoolean() splitResponse?: boolean
  @IsOptional() @IsBoolean() restrictTopics?: boolean
  @IsOptional() @IsBoolean() signName?: boolean
  @IsOptional() @IsString()  communicationTone?: string
  @IsOptional() @IsNumber()  inactivityMinutes?: number
  @IsOptional() @IsString()  inactivityAction?: string
  @IsOptional() @IsIn(['qualification', 'qualification_scheduling', 'qualification_scheduling_reminder', 'sales', 'support', 'reception', 'reactivation', 'survey'])
  purpose?: string
  @IsOptional() @IsString()  companyName?: string
  @IsOptional() @IsString()  companyUrl?: string
  @IsOptional() @IsString()  conversationFlow?: string
  @IsOptional() @IsBoolean() leadDispatchEnabled?: boolean
  @IsOptional() @IsString()  leadDispatchPhone?: string
  @IsOptional() @IsBoolean() reminderEnabled?: boolean
  @IsOptional() @IsNumber()  reminderMinutes?: number
  @IsOptional() @IsString()  reminderMessage?: string
}

class UpdateStatusDto {
  @IsEnum(['ACTIVE', 'PAUSED'])
  status!: Extract<AgentStatus, 'ACTIVE' | 'PAUSED'>
}

class TestAgentDto {
  @IsString()
  @MinLength(1)
  message!: string
}

// =============================================
// Controller
// =============================================

@Controller('agents')
@UseGuards(JwtGuard)
export class AgentsController {
  constructor(
    private readonly svc: AgentsService,
    private readonly refine: AgentRefineService,
  ) {}

  @Get()
  findAll(@Req() req: any, @Query('type') type?: string) {
    const agentType = (type === 'ATIVO' || type === 'PASSIVO') ? type as AgentType : undefined
    return this.svc.findAll(agentType, req.user?.tenantId)
  }

  @Get(':id')
  findOne(@Req() req: any, @Param('id') id: string) {
    return this.svc.findById(id, req.user?.tenantId)
  }

  @Post()
  create(@Req() req: any, @Body() dto: CreateAgentDto) {
    return this.svc.create({ ...dto, model: dto.model || DEFAULT_AGENT_MODEL }, req.user?.tenantId)
  }

  @Patch(':id')
  update(@Req() req: any, @Param('id') id: string, @Body() dto: UpdateAgentDto) {
    return this.svc.update(id, dto, req.user?.tenantId)
  }

  @Patch(':id/status')
  updateStatus(@Req() req: any, @Param('id') id: string, @Body() dto: UpdateStatusDto) {
    return this.svc.updateStatus(id, dto.status, req.user?.tenantId)
  }

  @Delete(':id')
  remove(@Req() req: any, @Param('id') id: string) {
    return this.svc.remove(id, req.user?.tenantId)
  }

  @Post(':id/test')
  test(@Req() req: any, @Param('id') id: string, @Body() dto: TestAgentDto) {
    return this.svc.test(id, dto.message, req.user?.tenantId)
  }

  @Post(':id/generate-dna')
  async generateDna(@Req() req: any, @Param('id') id: string) {
    const agent = await this.svc.findById(id, req.user?.tenantId)
    return this.refine.generateDna({
      name: agent.name,
      companyName: agent.companyName,
      companyUrl: agent.companyUrl,
      description: agent.description,
      purpose: agent.purpose,
      communicationTone: agent.communicationTone,
    })
  }

  @Post(':id/refine-personality')
  async refinePersonality(@Req() req: any, @Param('id') id: string) {
    const agent = await this.svc.findById(id, req.user?.tenantId)
    const refined = await this.refine.refinePersonality({
      name: agent.name,
      companyName: agent.companyName,
      purpose: agent.purpose,
      communicationTone: agent.communicationTone,
      personality: agent.personality,
    })
    return { personality: refined }
  }

  @Post(':id/refine-action')
  async refineAction(@Req() req: any, @Param('id') id: string) {
    const agent = await this.svc.findById(id, req.user?.tenantId)
    const refined = await this.refine.refineActionPrompt({
      name: agent.name,
      companyName: agent.companyName,
      purpose: agent.purpose,
      communicationTone: agent.communicationTone,
      actionPrompt: agent.actionPrompt,
    })
    return { actionPrompt: refined }
  }
}
