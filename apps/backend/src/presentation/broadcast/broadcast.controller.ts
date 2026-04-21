/**
 * BroadcastController — API de campanhas de mensagens
 *
 * GET    /broadcast            → lista campanhas
 * POST   /broadcast            → cria campanha (DRAFT)
 * GET    /broadcast/:id        → detalhe + status atual
 * POST   /broadcast/:id/launch → lança campanha (DRAFT → QUEUED)
 */

import { Body, Controller, Get, Param, Post, UseGuards } from '@nestjs/common'
import { IsArray, IsInt, IsNotEmpty, IsOptional, IsString, ArrayMinSize, Min } from 'class-validator'
import { JwtGuard }          from '@/shared/guards/jwt.guard'
import { CurrentTenantId }   from '@/shared/decorators/tenant.decorator'
import { BroadcastService }  from '@/features/broadcast/broadcast.service'

class CreateBroadcastDto {
  @IsOptional()
  @IsString()
  channelId?: string

  @IsString()
  @IsNotEmpty()
  name: string

  @IsString()
  @IsNotEmpty()
  template: string

  @IsArray()
  @ArrayMinSize(1)
  @IsString({ each: true })
  audience: string[]

  @IsOptional()
  @IsInt()
  @Min(1)
  messageDelayMinSeconds?: number

  @IsOptional()
  @IsInt()
  @Min(1)
  messageDelayMaxSeconds?: number

  @IsOptional()
  @IsInt()
  @Min(1)
  batchSizeMin?: number

  @IsOptional()
  @IsInt()
  @Min(1)
  batchSizeMax?: number

  @IsOptional()
  @IsInt()
  @Min(1)
  batchIntervalMinMinutes?: number

  @IsOptional()
  @IsInt()
  @Min(1)
  batchIntervalMaxMinutes?: number
}

@UseGuards(JwtGuard)
@Controller('broadcast')
export class BroadcastController {
  constructor(private readonly svc: BroadcastService) {}

  @Get()
  findAll(@CurrentTenantId() tenantId: string) {
    return this.svc.findAll(tenantId)
  }

  @Post()
  create(@CurrentTenantId() tenantId: string, @Body() dto: CreateBroadcastDto) {
    return this.svc.create({
      channelId:               dto.channelId,
      name:                    dto.name,
      template:                dto.template,
      audience:                dto.audience,
      messageDelayMinSeconds:  dto.messageDelayMinSeconds,
      messageDelayMaxSeconds:  dto.messageDelayMaxSeconds,
      batchSizeMin:            dto.batchSizeMin,
      batchSizeMax:            dto.batchSizeMax,
      batchIntervalMinMinutes: dto.batchIntervalMinMinutes,
      batchIntervalMaxMinutes: dto.batchIntervalMaxMinutes,
    }, tenantId)
  }

  @Get(':id')
  findOne(@CurrentTenantId() tenantId: string, @Param('id') id: string) {
    return this.svc.findById(id, tenantId)
  }

  @Post(':id/launch')
  launch(@CurrentTenantId() tenantId: string, @Param('id') id: string) {
    return this.svc.launch(id, tenantId)
  }
}
