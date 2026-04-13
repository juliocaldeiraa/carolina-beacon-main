import {
  Controller, Get, Post, Delete, Patch,
  Param, Query, Body, Res, UseGuards, Req, HttpCode, HttpStatus,
} from '@nestjs/common'
import { IsString, IsOptional, IsNumber, IsBoolean } from 'class-validator'
import { Response } from 'express'
import { JwtGuard } from '@/shared/guards/jwt.guard'
import { GoogleCalendarService } from '@/infrastructure/google-calendar/google-calendar.service'

class UpdateCalendarConfigDto {
  @IsOptional() @IsString()  calendarId?: string
  @IsOptional() @IsString()  calendarName?: string
  @IsOptional() @IsNumber()  slotDuration?: number
  @IsOptional() @IsBoolean() googleMeet?: boolean
  @IsOptional() @IsString()  eventTitle?: string
  @IsOptional() @IsBoolean() collectName?: boolean
  @IsOptional() @IsBoolean() collectEmail?: boolean
  @IsOptional() @IsBoolean() collectPhone?: boolean
  @IsOptional() @IsBoolean() sendSummary?: boolean
  @IsOptional() @IsBoolean() consultHours?: boolean
  @IsOptional() @IsBoolean() restrictFull?: boolean
}

@Controller('integrations/google')
export class GoogleCalendarController {
  constructor(private readonly calendar: GoogleCalendarService) {}

  /** Step 1: Redireciona para consent screen do Google (sem JWT — é um redirect do browser) */
  @Get('auth/:agentId')
  auth(@Param('agentId') agentId: string, @Query('tenantId') tenantId: string, @Res() res: Response) {
    const url = this.calendar.getAuthUrl(agentId, tenantId || 't1')
    res.redirect(url)
  }

  /** Step 2: Google redireciona de volta com code */
  @Get('callback')
  async callback(@Query('code') code: string, @Query('state') state: string, @Res() res: Response) {
    const { agentId } = await this.calendar.handleCallback(code, state)
    // Redireciona de volta para a página do agente
    res.redirect(`/agents/${agentId}`)
  }

  /** Lista calendários disponíveis */
  @Get('calendars/:agentId')
  @UseGuards(JwtGuard)
  listCalendars(@Param('agentId') agentId: string) {
    return this.calendar.listCalendars(agentId)
  }

  /** Retorna configuração atual */
  @Get('config/:agentId')
  @UseGuards(JwtGuard)
  getConfig(@Param('agentId') agentId: string) {
    return this.calendar.getIntegration(agentId)
  }

  /** Atualiza configuração */
  @Patch('config/:agentId')
  @UseGuards(JwtGuard)
  updateConfig(@Param('agentId') agentId: string, @Body() dto: UpdateCalendarConfigDto) {
    return this.calendar.updateConfig(agentId, dto)
  }

  /** Desconecta Google Calendar */
  @Delete(':agentId')
  @UseGuards(JwtGuard)
  @HttpCode(HttpStatus.NO_CONTENT)
  disconnect(@Param('agentId') agentId: string) {
    return this.calendar.disconnect(agentId)
  }
}
