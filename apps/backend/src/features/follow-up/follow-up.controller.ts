import { Controller, Get, Post, Patch, Delete, Body, Param, UseGuards } from '@nestjs/common'
import { IsString, IsNumber, Min, IsOptional, IsBoolean, IsArray } from 'class-validator'
import { Type } from 'class-transformer'
import { JwtGuard } from '@/shared/guards/jwt.guard'
import { FollowUpService } from './follow-up.service'

class CreateFollowUpWithTemplateDto {
  @IsNumber() @Min(1) @Type(() => Number)
  order!: number

  @IsArray() @IsArray({ each: true })
  variations!: string[][]

  @IsNumber() @Min(1) @Type(() => Number)
  triggerAfterMinutes!: number

  @IsOptional() @IsString()
  triggerOnStatus?: string
}

class UpdateFollowUpDto {
  @IsOptional() @IsNumber() @Min(1) @Type(() => Number)
  triggerAfterMinutes?: number

  @IsOptional() @IsString()
  triggerOnStatus?: string

  @IsOptional() @IsBoolean()
  isActive?: boolean
}

@Controller('campaigns/:campaignId/follow-up-rules')
@UseGuards(JwtGuard)
export class FollowUpController {
  constructor(private readonly followUp: FollowUpService) {}

  @Get()
  findAll(@Param('campaignId') campaignId: string) {
    return this.followUp.findByCampaign(campaignId)
  }

  @Post('with-template')
  createWithTemplate(
    @Param('campaignId') campaignId: string,
    @Body() dto: CreateFollowUpWithTemplateDto,
  ) {
    return this.followUp.createWithTemplate(campaignId, dto)
  }

  @Delete('order/:order')
  removeByOrder(
    @Param('campaignId') campaignId: string,
    @Param('order') order: string,
  ) {
    return this.followUp.deleteByOrder(campaignId, parseInt(order))
  }

  @Patch(':id')
  update(@Param('id') id: string, @Body() dto: UpdateFollowUpDto) {
    return this.followUp.updateRule(id, dto)
  }

  @Delete(':id')
  remove(@Param('id') id: string) {
    return this.followUp.removeRule(id)
  }
}
