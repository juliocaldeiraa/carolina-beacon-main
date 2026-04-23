/**
 * ChannelsController — API de gerenciamento de canais
 *
 * GET    /channels                 → lista todos os canais
 * POST   /channels                 → cadastra novo canal
 * POST   /channels/check-conflicts → verifica conflitos de uso por channelIds
 * GET    /channels/:id             → detalhe do canal
 * PATCH  /channels/:id             → atualiza configuração
 * DELETE /channels/:id             → remove canal
 * POST   /channels/:id/check       → verifica status imediatamente
 */

import { Body, Controller, Delete, Get, Param, Patch, Post, Req, UseGuards } from '@nestjs/common'
import { IsEnum, IsNotEmpty, IsObject, IsOptional, IsString } from 'class-validator'
import { JwtGuard } from '@/shared/guards/jwt.guard'
import { ChannelsService } from '@/features/channels/channels.service'
import type { ChannelType } from '@/core/entities/Channel'

class CreateChannelDto {
  @IsString()
  @IsNotEmpty()
  name: string

  @IsEnum(['EVOLUTION_API', 'ZAPI', 'WHATSAPP_OFFICIAL', 'TELEGRAM', 'INSTAGRAM'])
  type: ChannelType

  @IsOptional()
  @IsString()
  phoneNumber?: string

  @IsObject()
  config: Record<string, string>
}

class UpdateChannelDto {
  @IsOptional()
  @IsString()
  @IsNotEmpty()
  name?: string

  @IsOptional()
  @IsString()
  phoneNumber?: string

  @IsOptional()
  @IsObject()
  config?: Record<string, string>
}

@UseGuards(JwtGuard)
@Controller('channels')
export class ChannelsController {
  constructor(private readonly svc: ChannelsService) {}

  @Get()
  findAll(@Req() req: any) {
    return this.svc.findAll(req.user?.tenantId)
  }

  @Get(':id')
  findOne(@Req() req: any, @Param('id') id: string) {
    return this.svc.findById(id, req.user?.tenantId)
  }

  @Post()
  create(@Req() req: any, @Body() dto: CreateChannelDto) {
    return this.svc.create(dto, req.user?.tenantId)
  }

  @Patch(':id')
  update(@Req() req: any, @Param('id') id: string, @Body() dto: UpdateChannelDto) {
    return this.svc.update(id, dto, req.user?.tenantId)
  }

  @Delete(':id')
  remove(@Req() req: any, @Param('id') id: string) {
    return this.svc.remove(id, req.user?.tenantId)
  }

  @Post(':id/check')
  check(@Req() req: any, @Param('id') id: string) {
    return this.svc.checkStatus(id, req.user?.tenantId)
  }

  @Post('check-conflicts')
  checkConflicts(@Req() req: any, @Body() body: { channelIds: string[] }) {
    return this.svc.checkConflicts(body.channelIds ?? [], req.user?.tenantId)
  }
}
