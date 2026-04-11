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

import { Body, Controller, Delete, Get, Param, Patch, Post, UseGuards } from '@nestjs/common'
import { IsArray, IsEnum, IsNotEmpty, IsObject, IsOptional, IsString } from 'class-validator'
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
  findAll() {
    return this.svc.findAll()
  }

  @Get(':id')
  findOne(@Param('id') id: string) {
    return this.svc.findById(id)
  }

  @Post()
  create(@Body() dto: CreateChannelDto) {
    return this.svc.create(dto)
  }

  @Patch(':id')
  update(@Param('id') id: string, @Body() dto: UpdateChannelDto) {
    return this.svc.update(id, dto)
  }

  @Delete(':id')
  remove(@Param('id') id: string) {
    return this.svc.remove(id)
  }

  @Post(':id/check')
  check(@Param('id') id: string) {
    return this.svc.checkStatus(id)
  }

  @Post('check-conflicts')
  checkConflicts(@Body() body: { channelIds: string[] }) {
    return this.svc.checkConflicts(body.channelIds ?? [])
  }
}
