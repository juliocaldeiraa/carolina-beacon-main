/**
 * AutomationsController — API de automações de disparo inteligente
 *
 * GET    /automations                  → lista (ADMIN, EQUIPE)
 * GET    /automations/:id              → detalhe com logs e stats (ADMIN, EQUIPE)
 * POST   /automations                  → cria (ADMIN)
 * PATCH  /automations/:id              → atualiza config/status (ADMIN)
 * DELETE /automations/:id              → remove (ADMIN)
 * POST   /automations/:id/test-fire    → dispara teste imediato (ADMIN, EQUIPE)
 * POST   /automations/:id/test-clear   → limpa histórico de teste (ADMIN, EQUIPE)
 */

import {
  Body, Controller, Delete, Get, Param,
  Patch, Post, Query, UseGuards,
} from '@nestjs/common'
import {
  IsArray, IsBoolean, IsEnum, IsInt, IsNotEmpty, IsOptional,
  IsString, Max, Min, ValidateNested,
} from 'class-validator'
import { Type } from 'class-transformer'
import { JwtGuard }           from '@/shared/guards/jwt.guard'
import { RolesGuard }         from '@/shared/guards/roles.guard'
import { Roles }              from '@/shared/decorators/roles.decorator'
import { AutomationsService } from '@/features/automations/automations.service'

class FollowupStepDto {
  @IsInt()
  @Min(1)
  afterHours: number

  @IsArray()
  @IsString({ each: true })
  templates: string[]
}

class CreateAutomationDto {
  @IsString()
  @IsNotEmpty()
  name: string

  @IsOptional()
  @IsString()
  channelId?: string

  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  fallbackChannelIds?: string[]

  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => FollowupStepDto)
  followupSteps?: FollowupStepDto[]

  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  messageTemplates?: string[]

  @IsOptional()
  @IsString()
  linkedAgentId?: string

  @IsOptional()
  @IsString()
  filterStatus?: string

  @IsOptional()
  @IsInt()
  @Min(0)
  minHoursAfterCapture?: number

  @IsOptional()
  @IsInt()
  @Min(0)
  @Max(23)
  startHour?: number

  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(24)
  endHour?: number

  @IsOptional()
  @IsInt()
  @Min(1)
  batchIntervalMinMinutes?: number

  @IsOptional()
  @IsInt()
  @Min(1)
  batchIntervalMaxMinutes?: number

  @IsOptional()
  @IsInt()
  @Min(1)
  batchSizeMin?: number

  @IsOptional()
  @IsInt()
  @Min(1)
  batchSizeMax?: number

  @IsOptional()
  @IsString()
  aiChannelId?: string

  @IsOptional()
  @IsString()
  aiModel?: string

  @IsOptional()
  @IsInt()
  @Min(500)
  @Max(15000)
  debounceMs?: number

  @IsOptional()
  @IsInt()
  @Min(0)
  @Max(30000)
  sendDelayMs?: number

  @IsOptional()
  @IsInt()
  @Min(300)
  @Max(5000)
  fragmentDelayMs?: number

  @IsOptional()
  @IsBoolean()
  followupEnabled?: boolean

  @IsOptional()
  @IsBoolean()
  useExclusionList?: boolean

  @IsOptional()
  @IsString()
  exclusionFilterStatus?: string | null

  @IsOptional()
  @IsInt()
  @Min(5000)
  @Max(600000)
  dispatchDelayMinMs?: number

  @IsOptional()
  @IsInt()
  @Min(5000)
  @Max(600000)
  dispatchDelayMaxMs?: number

  @IsOptional()
  @IsBoolean()
  humanHandoffEnabled?: boolean

  @IsOptional()
  @IsString()
  humanHandoffPhone?: string | null

  @IsOptional()
  @IsString()
  humanHandoffMessage?: string | null
}

class UpdateAutomationDto {
  @IsOptional()
  @IsString()
  @IsNotEmpty()
  name?: string

  @IsOptional()
  @IsEnum(['ACTIVE', 'INACTIVE'])
  status?: 'ACTIVE' | 'INACTIVE'

  @IsOptional()
  @IsString()
  channelId?: string

  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  fallbackChannelIds?: string[]

  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => FollowupStepDto)
  followupSteps?: FollowupStepDto[]

  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  messageTemplates?: string[]

  @IsOptional()
  @IsString()
  linkedAgentId?: string

  @IsOptional()
  @IsString()
  filterStatus?: string

  @IsOptional()
  @IsInt()
  @Min(0)
  minHoursAfterCapture?: number

  @IsOptional()
  @IsInt()
  @Min(0)
  @Max(23)
  startHour?: number

  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(24)
  endHour?: number

  @IsOptional()
  @IsInt()
  @Min(1)
  batchIntervalMinMinutes?: number

  @IsOptional()
  @IsInt()
  @Min(1)
  batchIntervalMaxMinutes?: number

  @IsOptional()
  @IsInt()
  @Min(1)
  batchSizeMin?: number

  @IsOptional()
  @IsInt()
  @Min(1)
  batchSizeMax?: number

  @IsOptional()
  @IsString()
  aiChannelId?: string

  @IsOptional()
  @IsString()
  aiModel?: string

  @IsOptional()
  @IsInt()
  @Min(500)
  @Max(15000)
  debounceMs?: number

  @IsOptional()
  @IsInt()
  @Min(0)
  @Max(30000)
  sendDelayMs?: number

  @IsOptional()
  @IsInt()
  @Min(300)
  @Max(5000)
  fragmentDelayMs?: number

  @IsOptional()
  @IsBoolean()
  followupEnabled?: boolean

  @IsOptional()
  @IsBoolean()
  useExclusionList?: boolean

  @IsOptional()
  @IsString()
  exclusionFilterStatus?: string | null

  @IsOptional()
  @IsInt()
  @Min(5000)
  @Max(600000)
  dispatchDelayMinMs?: number

  @IsOptional()
  @IsInt()
  @Min(5000)
  @Max(600000)
  dispatchDelayMaxMs?: number

  @IsOptional()
  @IsBoolean()
  humanHandoffEnabled?: boolean

  @IsOptional()
  @IsString()
  humanHandoffPhone?: string | null

  @IsOptional()
  @IsString()
  humanHandoffMessage?: string | null

  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  testPhones?: string[]
}

@UseGuards(JwtGuard, RolesGuard)
@Controller('automations')
export class AutomationsController {
  constructor(private readonly svc: AutomationsService) {}

  @Get()
  @Roles('ADMIN', 'EQUIPE')
  findAll() {
    return this.svc.findAll()
  }

  @Get('lead-statuses')
  @Roles('ADMIN', 'EQUIPE')
  getLeadStatuses() {
    return this.svc.getLeadStatuses()
  }

  @Get(':id')
  @Roles('ADMIN', 'EQUIPE')
  async findOne(@Param('id') id: string) {
    const automation = await this.svc.findById(id)
    const stats      = await this.svc.getStats(id)
    return { ...automation, stats }
  }

  @Post()
  @Roles('ADMIN')
  create(@Body() dto: CreateAutomationDto) {
    return this.svc.create(dto)
  }

  @Patch(':id')
  @Roles('ADMIN')
  update(@Param('id') id: string, @Body() dto: UpdateAutomationDto) {
    return this.svc.update(id, dto)
  }

  @Delete(':id')
  @Roles('ADMIN')
  remove(@Param('id') id: string) {
    return this.svc.remove(id)
  }

  @Post(':id/test-fire')
  @Roles('ADMIN', 'EQUIPE')
  testFire(
    @Param('id') id: string,
    @Body() body: { phones?: string[]; templateIndex?: number },
  ) {
    return this.svc.testFire(id, body)
  }

  @Post(':id/test-clear')
  @Roles('ADMIN', 'EQUIPE')
  testClear(
    @Param('id') id: string,
    @Body() body: { phones?: string[] },
  ) {
    return this.svc.testClear(id, body)
  }

  @Post(':id/test-status')
  @Roles('ADMIN', 'EQUIPE')
  testStatus(
    @Param('id') id: string,
    @Body() body: { phones: string[] },
  ) {
    return this.svc.testStatus(id, body)
  }

  @Get(':id/dispatch-logs')
  @Roles('ADMIN', 'EQUIPE')
  getDispatchLogs(
    @Param('id') id: string,
    @Query('limit') limit?: string,
  ) {
    return this.svc.getDispatchLogs(id, limit ? Number(limit) : 60)
  }
}
