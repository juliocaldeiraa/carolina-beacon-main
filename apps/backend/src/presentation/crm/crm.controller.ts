import {
  Controller, Get, Post, Patch, Delete,
  Param, Query, Body, UseGuards, HttpCode, HttpStatus, Req,
} from '@nestjs/common'
import { IsString, IsOptional } from 'class-validator'
import { JwtGuard } from '../../shared/guards/jwt.guard'
import { RolesGuard } from '../../shared/guards/roles.guard'
import { Roles } from '../../shared/decorators/roles.decorator'
import {
  CrmService, CreateCardDto, UpdateCardDto, CreatePipelineDto,
} from '../../features/crm/crm.service'
import { WhatsAppCrmService } from '../../features/crm/whatsapp-crm.service'

class UpdateLeadKanbanDto {
  @IsString()
  kanbanColumn!: string

  @IsOptional()
  @IsString()
  conversionValue?: string
}

class CreateShareDto {
  @IsString()
  campaignId!: string

  @IsOptional()
  @IsString()
  label?: string
}

function tenantId(req: any): string {
  return req.user?.tenantId
}

@Controller('crm')
@UseGuards(JwtGuard, RolesGuard)
@Roles('ADMIN', 'EQUIPE', 'SUPORTE', 'COMERCIAL')
export class CrmController {
  constructor(
    private readonly svc: CrmService,
    private readonly whatsappCrm: WhatsAppCrmService,
  ) {}

  // ─── Kanban de Leads (Campanhas) ─────────────────────────────

  @Get('leads')
  findLeads(
    @Req() req: any,
    @Query('campaignId') campaignId?: string,
    @Query('search')     search?: string,
  ) {
    return this.svc.findLeadsForKanban(tenantId(req), { campaignId, search })
  }

  @Patch('leads/:id/column')
  updateLeadColumn(
    @Param('id') id: string,
    @Body() dto: UpdateLeadKanbanDto,
    @Req() req: any,
  ) {
    return this.svc.updateLeadKanban(id, tenantId(req), dto.kanbanColumn, dto.conversionValue)
  }

  // ─── Shares ──────────────────────────────────────────────────

  @Get('shares')
  listShares(@Req() req: any) {
    return this.svc.listShares(tenantId(req))
  }

  @Post('shares')
  createShare(@Body() dto: CreateShareDto, @Req() req: any) {
    return this.svc.createShare(tenantId(req), dto.campaignId, dto.label)
  }

  @Delete('shares/:id')
  @HttpCode(HttpStatus.NO_CONTENT)
  deleteShare(@Param('id') id: string, @Req() req: any) {
    return this.svc.deleteShare(id, tenantId(req))
  }

  // ─── Pipelines ────────────────────────────────────────────

  @Get('pipelines')
  findAllPipelines() {
    return this.svc.findAllPipelines()
  }

  @Get('pipelines/:id')
  findPipeline(@Param('id') id: string) {
    return this.svc.findPipelineById(id)
  }

  @Post('pipelines')
  @Roles('ADMIN')
  createPipeline(@Body() dto: CreatePipelineDto) {
    return this.svc.createPipeline(dto)
  }

  // ─── Cards ────────────────────────────────────────────────

  @Get('cards')
  findAllCards(
    @Query('pipelineId') pipelineId?: string,
    @Query('stage')      stage?: string,
    @Query('search')     search?: string,
  ) {
    return this.svc.findAllCards(pipelineId, stage, search)
  }

  @Post('cards')
  createCard(@Body() dto: CreateCardDto) {
    return this.svc.createCard(dto)
  }

  @Patch('cards/:id')
  updateCard(@Param('id') id: string, @Body() dto: UpdateCardDto) {
    return this.svc.updateCard(id, dto)
  }

  @Delete('cards/:id')
  @HttpCode(HttpStatus.NO_CONTENT)
  removeCard(@Param('id') id: string) {
    return this.svc.removeCard(id)
  }

  // ─── WhatsApp Leads CRM ──────────────────────────────────────

  @Get('whatsapp-leads')
  findWhatsAppLeads(
    @Req() req: any,
    @Query('agentId') agentId?: string,
    @Query('stage') stage?: string,
    @Query('search') search?: string,
  ) {
    return this.whatsappCrm.findLeads({ agentId, stage, search }, tenantId(req))
  }

  @Patch('whatsapp-leads/:id/stage')
  moveWhatsAppLead(
    @Param('id') id: string,
    @Body() body: { stage: string; lostReason?: string },
  ) {
    return this.whatsappCrm.moveToStage(id, body.stage, body.lostReason)
  }

  @Patch('whatsapp-leads/:id/notes')
  updateWhatsAppLeadNotes(
    @Param('id') id: string,
    @Body() body: { notes: string },
  ) {
    return this.whatsappCrm.updateNotes(id, body.notes)
  }

  @Get('whatsapp-leads/stats')
  getWhatsAppLeadStats(@Req() req: any, @Query('agentId') agentId?: string) {
    return this.whatsappCrm.getStats(agentId, tenantId(req))
  }
}
