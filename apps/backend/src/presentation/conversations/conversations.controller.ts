import {
  Controller, Get, Patch,
  Param, Query, Body, UseGuards, Req,
} from '@nestjs/common'
import { JwtGuard } from '../../shared/guards/jwt.guard'
import { RolesGuard } from '../../shared/guards/roles.guard'
import { Roles } from '../../shared/decorators/roles.decorator'
import { ConversationsService } from '../../features/conversations/conversations.service'

function tenantId(req: any): string {
  return req.user?.tenantId
}

@Controller('conversations')
@UseGuards(JwtGuard, RolesGuard)
@Roles('ADMIN', 'EQUIPE', 'SUPORTE', 'COMERCIAL')
export class ConversationsController {
  constructor(private readonly svc: ConversationsService) {}

  @Get()
  findAll(
    @Req() req: any,
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
    }, tenantId(req))
  }

  @Get(':id')
  findOne(@Req() req: any, @Param('id') id: string) {
    return this.svc.findById(id, tenantId(req))
  }

  @Patch(':id/status')
  updateStatus(
    @Req() req: any,
    @Param('id') id: string,
    @Body('status') status: string,
  ) {
    return this.svc.updateStatus(id, status, tenantId(req))
  }

  @Patch(':id/takeover')
  setTakeover(
    @Req() req: any,
    @Param('id') id: string,
    @Body('active') active: boolean,
  ) {
    return this.svc.setHumanTakeover(id, active, tenantId(req))
  }
}
