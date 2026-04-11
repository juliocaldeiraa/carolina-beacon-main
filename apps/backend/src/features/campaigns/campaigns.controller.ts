import {
  Controller, Get, Post, Patch, Delete,
  Body, Param, UseGuards, Req,
} from '@nestjs/common'
import { IsString, IsOptional, IsNumber, Min, Max, IsArray, IsIn, IsBoolean } from 'class-validator'
import { Type } from 'class-transformer'
import { JwtGuard } from '@/shared/guards/jwt.guard'
import { CampaignsService } from './campaigns.service'

class ScheduleConfigDto {
  @IsOptional() @IsBoolean() scheduleEnabled?: boolean
  @IsOptional() @IsNumber() @Min(0) @Max(23) @Type(() => Number) scheduleStartHour?: number
  @IsOptional() @IsNumber() @Min(1) @Max(24) @Type(() => Number) scheduleEndHour?: number
  @IsOptional() @IsArray() @IsNumber({}, { each: true }) scheduleDays?: number[]
  @IsOptional() @IsString() scheduleTimezone?: string
}

class CreateCampaignDto extends ScheduleConfigDto {
  @IsString() name!: string
  @IsOptional() @IsString() channelId?: string
  @IsOptional() @IsString() agentId?: string
  @IsOptional() @IsNumber() @Min(120) @Type(() => Number) delayMinSec?: number
  @IsOptional() @IsNumber() @Min(120) @Type(() => Number) delayMaxSec?: number
  @IsOptional() @IsIn(['RANDOM', 'SEQUENTIAL']) rotationMode?: 'RANDOM' | 'SEQUENTIAL'
  @IsOptional() @IsString() scheduledAt?: string
  @IsOptional() @IsArray() @IsString({ each: true }) varLabels?: string[]
  @IsArray() @IsArray({ each: true }) initialVariations!: string[][]
}

class UpdateCampaignDto extends ScheduleConfigDto {
  @IsOptional() @IsString() name?: string
  @IsOptional() @IsString() channelId?: string
  @IsOptional() @IsString() agentId?: string
  @IsOptional() @IsNumber() @Min(120) @Type(() => Number) delayMinSec?: number
  @IsOptional() @IsNumber() @Min(120) @Type(() => Number) delayMaxSec?: number
  @IsOptional() @IsIn(['RANDOM', 'SEQUENTIAL']) rotationMode?: 'RANDOM' | 'SEQUENTIAL'
  @IsOptional() @IsString() scheduledAt?: string
  @IsOptional() @IsArray() @IsString({ each: true }) varLabels?: string[]
}

function tenantId(req: any): string {
  return req.user?.tenantId ?? process.env.DEFAULT_TENANT_ID!
}

@Controller('campaigns')
@UseGuards(JwtGuard)
export class CampaignsController {
  constructor(private readonly campaigns: CampaignsService) {}

  @Get()
  findAll(@Req() req: any) {
    return this.campaigns.findAll(tenantId(req))
  }

  @Get('funnel')
  getFunnel(@Req() req: any) {
    return this.campaigns.getFunnel(tenantId(req))
  }

  @Get(':id')
  findOne(@Param('id') id: string, @Req() req: any) {
    return this.campaigns.findById(id, tenantId(req))
  }

  @Post()
  create(@Body() dto: CreateCampaignDto, @Req() req: any) {
    return this.campaigns.create(dto, tenantId(req))
  }

  @Patch(':id')
  update(@Param('id') id: string, @Body() dto: UpdateCampaignDto, @Req() req: any) {
    return this.campaigns.update(id, dto, tenantId(req))
  }

  @Post(':id/launch')
  launch(@Param('id') id: string, @Req() req: any) {
    return this.campaigns.launch(id, tenantId(req))
  }

  @Post(':id/pause')
  pause(@Param('id') id: string, @Req() req: any) {
    return this.campaigns.pause(id, tenantId(req))
  }

  @Post(':id/resume')
  resume(@Param('id') id: string, @Req() req: any) {
    return this.campaigns.resume(id, tenantId(req))
  }

  @Post(':id/retry-errors')
  retryErrors(@Param('id') id: string, @Req() req: any) {
    return this.campaigns.retryErrors(id, tenantId(req))
  }

  @Patch(':id/template/initial')
  updateInitialTemplate(
    @Param('id') id: string,
    @Body() body: { variations: string[][] },
    @Req() req: any,
  ) {
    return this.campaigns.updateInitialTemplate(id, body.variations, tenantId(req))
  }

  @Post(':id/duplicate')
  duplicate(@Param('id') id: string, @Req() req: any) {
    return this.campaigns.duplicate(id, tenantId(req))
  }

  @Delete(':id')
  remove(@Param('id') id: string, @Req() req: any) {
    return this.campaigns.remove(id, tenantId(req))
  }
}
