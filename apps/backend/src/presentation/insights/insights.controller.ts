/**
 * InsightsController
 *
 * GET /insights/overview?from=&to=
 * GET /insights/campaigns?from=&to=&automationId=
 * GET /insights/chat?from=&to=&channelId=
 */

import { Controller, Get, Query, UseGuards } from '@nestjs/common'
import { JwtGuard }       from '@/shared/guards/jwt.guard'
import { RolesGuard }     from '@/shared/guards/roles.guard'
import { Roles }          from '@/shared/decorators/roles.decorator'
import { InsightsService } from '@/features/insights/insights.service'

/** Converte período em datas ISO (fallback: últimos 30 dias) */
function resolveDates(from?: string, to?: string): { from: string; to: string } {
  const t  = to   ? new Date(to)   : new Date()
  const f  = from ? new Date(from) : new Date(Date.now() - 30 * 24 * 60 * 60 * 1000)
  return { from: f.toISOString(), to: t.toISOString() }
}

@UseGuards(JwtGuard, RolesGuard)
@Controller('insights')
export class InsightsController {
  constructor(private readonly svc: InsightsService) {}

  @Get('overview')
  @Roles('ADMIN', 'EQUIPE')
  getOverview(@Query('from') from?: string, @Query('to') to?: string) {
    const d = resolveDates(from, to)
    return this.svc.getOverview(d.from, d.to)
  }

  @Get('vendedor')
  @Roles('ADMIN', 'EQUIPE')
  getVendedor() {
    return this.svc.getVendedor()
  }

  @Get('campaigns')
  @Roles('ADMIN', 'EQUIPE')
  getCampaigns(
    @Query('from')          from?:          string,
    @Query('to')            to?:            string,
    @Query('automationId')  automationId?:  string,
  ) {
    const d = resolveDates(from, to)
    return this.svc.getCampaigns(d.from, d.to, automationId || undefined)
  }

  @Get('chat')
  @Roles('ADMIN', 'EQUIPE')
  getChat(
    @Query('from')       from?:      string,
    @Query('to')         to?:        string,
    @Query('channelId')  channelId?: string,
  ) {
    const d = resolveDates(from, to)
    return this.svc.getChat(d.from, d.to, channelId || undefined)
  }
}
