import {
  Controller, Get, Patch,
  Param, Query, Body, UseGuards,
} from '@nestjs/common'
import { JwtGuard } from '../../shared/guards/jwt.guard'
import { RolesGuard } from '../../shared/guards/roles.guard'
import { Roles } from '../../shared/decorators/roles.decorator'
import { ConversationsService } from '../../features/conversations/conversations.service'

@Controller('conversations')
@UseGuards(JwtGuard, RolesGuard)
@Roles('ADMIN', 'EQUIPE', 'SUPORTE', 'COMERCIAL')
export class ConversationsController {
  constructor(private readonly svc: ConversationsService) {}

  @Get()
  findAll(
    @Query('channelId') channelId?: string,
    @Query('status')    status?: string,
    @Query('search')    search?: string,
    @Query('page')      page?: string,
    @Query('limit')     limit?: string,
  ) {
    return this.svc.findAll({
      channelId,
      status,
      search,
      page:  page  ? Number(page)  : 1,
      limit: limit ? Number(limit) : 30,
    })
  }

  @Get(':id')
  findOne(@Param('id') id: string) {
    return this.svc.findById(id)
  }

  @Patch(':id/status')
  updateStatus(
    @Param('id') id: string,
    @Body('status') status: string,
  ) {
    return this.svc.updateStatus(id, status)
  }

  @Patch(':id/takeover')
  setTakeover(
    @Param('id') id: string,
    @Body('active') active: boolean,
  ) {
    return this.svc.setHumanTakeover(id, active)
  }
}
