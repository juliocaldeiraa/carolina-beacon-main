import {
  Controller, Get, Post, Patch, Delete,
  Param, Query, Body, UseGuards, HttpCode, HttpStatus,
} from '@nestjs/common'
import { JwtGuard } from '../../shared/guards/jwt.guard'
import { RolesGuard } from '../../shared/guards/roles.guard'
import { Roles } from '../../shared/decorators/roles.decorator'
import {
  CrmService, CreateCardDto, UpdateCardDto, CreatePipelineDto,
} from '../../features/crm/crm.service'

@Controller('crm')
@UseGuards(JwtGuard, RolesGuard)
@Roles('ADMIN', 'EQUIPE', 'SUPORTE', 'COMERCIAL')
export class CrmController {
  constructor(private readonly svc: CrmService) {}

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
}
