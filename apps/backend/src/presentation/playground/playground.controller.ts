/**
 * PlaygroundController — Endpoints de sessões de teste
 *
 * POST   /playground/session         → cria sessão (com contexto opcional)
 * POST   /playground/chat            → envia mensagem ao agente
 * DELETE /playground/session/:id     → limpa histórico
 * GET    /playground/broadcasts      → lista disparos disponíveis
 * GET    /playground/automations     → lista automações disponíveis
 */

import { Body, Controller, Delete, Get, Param, Post, UseGuards } from '@nestjs/common'
import {
  IsArray, IsNotEmpty, IsOptional, IsString, IsUUID, ValidateNested,
} from 'class-validator'
import { Type } from 'class-transformer'
import { JwtGuard }          from '@/shared/guards/jwt.guard'
import { CurrentTenantId }   from '@/shared/decorators/tenant.decorator'
import { PlaygroundService } from '@/features/playground/playground.service'
import type { SessionMessage } from '@/features/playground/playground.service'

// ─── DTOs ─────────────────────────────────────────────────────────────────────

class ContextMessageDto {
  @IsString()
  role: 'user' | 'assistant'

  @IsString()
  content: string
}

class CreateSessionDto {
  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => ContextMessageDto)
  contextMessages?: ContextMessageDto[]
}

class ChatDto {
  @IsUUID()
  agentId: string

  @IsUUID()
  sessionId: string

  @IsString()
  @IsNotEmpty()
  message: string

  @IsOptional()
  @IsString()
  model?: string
}

// ─── Controller ───────────────────────────────────────────────────────────────

@UseGuards(JwtGuard)
@Controller('playground')
export class PlaygroundController {
  constructor(private readonly svc: PlaygroundService) {}

  @Post('session')
  createSession(@Body() dto: CreateSessionDto) {
    const context = (dto.contextMessages ?? []).map((m) => ({
      role:      m.role,
      content:   m.content,
      timestamp: new Date().toISOString(),
    })) as SessionMessage[]
    return { sessionId: this.svc.createSession(context) }
  }

  @Post('chat')
  chat(@Body() dto: ChatDto) {
    return this.svc.chat(dto.agentId, dto.sessionId, dto.message, dto.model)
  }

  @Delete('session/:id')
  clearSession(@Param('id') id: string) {
    this.svc.clearSession(id)
    return { ok: true }
  }

  @Get('broadcasts')
  getBroadcasts(@CurrentTenantId() tenantId: string) {
    return this.svc.getBroadcasts(tenantId)
  }

  @Get('automations')
  getAutomations(@CurrentTenantId() tenantId: string) {
    return this.svc.getAutomations(tenantId)
  }
}
