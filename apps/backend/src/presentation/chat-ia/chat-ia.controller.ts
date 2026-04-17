/**
 * ChatIaController — API de configurações Canal + Agente + LLM
 *
 * GET    /chat-ia          → lista todas as configs (ADMIN, EQUIPE)
 * POST   /chat-ia          → cria (ADMIN, EQUIPE)
 * PATCH  /chat-ia/:id      → atualiza (ADMIN, EQUIPE)
 * DELETE /chat-ia/:id      → remove (ADMIN)
 */

import {
  Body, Controller, Delete, Get, Param,
  Patch, Post, UseGuards, Req,
} from '@nestjs/common'
import {
  IsBoolean, IsNotEmpty, IsNumber, IsOptional, IsString, Max, Min,
} from 'class-validator'
import { JwtGuard }      from '@/shared/guards/jwt.guard'
import { RolesGuard }    from '@/shared/guards/roles.guard'
import { Roles }         from '@/shared/decorators/roles.decorator'
import { ChatIaService } from '@/features/chat-ia/chat-ia.service'

class CreateChannelAgentDto {
  @IsString()
  @IsNotEmpty()
  name: string

  @IsString()
  @IsNotEmpty()
  channelId: string

  @IsString()
  @IsNotEmpty()
  agentId: string

  @IsString()
  @IsNotEmpty()
  llmModel: string

  @IsOptional()
  @IsBoolean()
  isActive?: boolean

  @IsOptional()
  @IsNumber()
  @Min(500)
  @Max(15000)
  debounceMs?: number

  @IsOptional()
  @IsNumber()
  @Min(300)
  @Max(5000)
  fragmentDelayMs?: number

  @IsOptional()
  @IsNumber()
  @Min(0)
  @Max(1440)
  humanTakeoverTimeoutMin?: number

  @IsOptional()
  @IsNumber()
  @Min(0)
  @Max(30000)
  sendDelayMs?: number

  @IsOptional()
  @IsBoolean()
  allowGroups?: boolean

  @IsOptional()
  @IsString()
  triggerMode?: string

  @IsOptional()
  triggerKeywords?: string[]
}

class UpdateChannelAgentDto {
  @IsOptional()
  @IsString()
  @IsNotEmpty()
  name?: string

  @IsOptional()
  @IsString()
  channelId?: string

  @IsOptional()
  @IsString()
  agentId?: string

  @IsOptional()
  @IsString()
  llmModel?: string

  @IsOptional()
  @IsBoolean()
  isActive?: boolean

  @IsOptional()
  @IsNumber()
  @Min(500)
  @Max(15000)
  debounceMs?: number

  @IsOptional()
  @IsNumber()
  @Min(300)
  @Max(5000)
  fragmentDelayMs?: number

  @IsOptional()
  @IsNumber()
  @Min(0)
  @Max(1440)
  humanTakeoverTimeoutMin?: number

  @IsOptional()
  @IsNumber()
  @Min(0)
  @Max(30000)
  sendDelayMs?: number

  @IsOptional()
  @IsBoolean()
  allowGroups?: boolean

  @IsOptional()
  @IsString()
  triggerMode?: string

  @IsOptional()
  triggerKeywords?: string[]
}

@UseGuards(JwtGuard, RolesGuard)
@Controller('chat-ia')
export class ChatIaController {
  constructor(private readonly svc: ChatIaService) {}

  @Get()
  @Roles('ADMIN', 'EQUIPE')
  findAll(@Req() req: any) {
    return this.svc.findAll(req.user?.tenantId)
  }

  @Post()
  @Roles('ADMIN', 'EQUIPE')
  create(@Body() dto: CreateChannelAgentDto, @Req() req: any) {
    return this.svc.create(dto, req.user?.tenantId)
  }

  @Patch(':id')
  @Roles('ADMIN', 'EQUIPE')
  update(@Param('id') id: string, @Body() dto: UpdateChannelAgentDto, @Req() req: any) {
    return this.svc.update(id, dto)
  }

  @Post(':id/test')
  @Roles('ADMIN', 'EQUIPE')
  testConnection(@Param('id') id: string, @Req() req: any) {
    return this.svc.testConnection(id, req.user?.tenantId)
  }

  @Delete(':id')
  @Roles('ADMIN')
  remove(@Param('id') id: string) {
    return this.svc.remove(id)
  }
}
