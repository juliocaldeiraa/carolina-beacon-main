import {
  Controller, Get, Post, Patch, Delete, Body, Param, Query,
  UseGuards, Request,
} from '@nestjs/common'
import { JwtGuard }         from '@/shared/guards/jwt.guard'
import { RolesGuard }       from '@/shared/guards/roles.guard'
import { Roles }            from '@/shared/decorators/roles.decorator'
import { ProfileService }   from '@/features/settings/profile.service'
import { AiProvidersService } from '@/features/settings/ai-providers.service'
import { WebhooksService }  from '@/features/settings/webhooks.service'
import { CentralAiService } from '@/features/settings/central-ai.service'
import { DatabaseService }  from '@/features/settings/database.service'
import type {
  UpdateProfileDto, ChangePasswordDto,
} from '@/features/settings/profile.service'
import type {
  CreateAiProviderDto, UpdateAiProviderDto,
} from '@/features/settings/ai-providers.service'
import type {
  CreateWebhookDto, UpdateWebhookDto,
} from '@/features/settings/webhooks.service'
import { CreateCentralAiDto, UpdateCentralAiDto } from '@/features/settings/central-ai.service'

@Controller('settings')
@UseGuards(JwtGuard, RolesGuard)
export class SettingsController {
  constructor(
    private readonly profileService: ProfileService,
    private readonly aiProvidersService: AiProvidersService,
    private readonly webhooksService: WebhooksService,
    private readonly centralAiService: CentralAiService,
    private readonly databaseService: DatabaseService,
  ) {}

  // ─── Profile (todos os roles) ───────────────────────────────────────────────

  @Get('profile')
  getProfile(@Request() req: any) {
    return this.profileService.getProfile(req.user.userId)
  }

  @Patch('profile')
  updateProfile(@Request() req: any, @Body() dto: UpdateProfileDto) {
    return this.profileService.updateProfile(req.user.userId, dto)
  }

  @Post('profile/change-password')
  changePassword(@Request() req: any, @Body() dto: ChangePasswordDto) {
    return this.profileService.changePassword(req.user.userId, dto)
  }

  // ─── AI Providers (ADMIN only) ─────────────────────────────────────────────

  @Get('ai-providers')
  @Roles('ADMIN')
  findAllProviders() {
    return this.aiProvidersService.findAll()
  }

  @Post('ai-providers')
  @Roles('ADMIN')
  createProvider(@Body() dto: CreateAiProviderDto) {
    return this.aiProvidersService.create(dto)
  }

  @Patch('ai-providers/:id')
  @Roles('ADMIN')
  updateProvider(@Param('id') id: string, @Body() dto: UpdateAiProviderDto) {
    return this.aiProvidersService.update(id, dto)
  }

  @Delete('ai-providers/:id')
  @Roles('ADMIN')
  removeProvider(@Param('id') id: string) {
    return this.aiProvidersService.remove(id)
  }

  // ─── Webhooks (ADMIN only) ─────────────────────────────────────────────────

  @Get('webhooks')
  @Roles('ADMIN')
  findAllWebhooks() {
    return this.webhooksService.findAll()
  }

  @Post('webhooks')
  @Roles('ADMIN')
  createWebhook(@Body() dto: CreateWebhookDto) {
    return this.webhooksService.create(dto)
  }

  @Patch('webhooks/:id')
  @Roles('ADMIN')
  updateWebhook(@Param('id') id: string, @Body() dto: UpdateWebhookDto) {
    return this.webhooksService.update(id, dto)
  }

  @Delete('webhooks/:id')
  @Roles('ADMIN')
  removeWebhook(@Param('id') id: string) {
    return this.webhooksService.remove(id)
  }

  @Post('webhooks/:id/test')
  @Roles('ADMIN')
  testWebhook(@Param('id') id: string) {
    return this.webhooksService.test(id)
  }

  // ─── IA Central (ADMIN only) ──────────────────────────────────────────────

  @Get('central-ai')
  @Roles('ADMIN')
  findAllCentralAi() {
    return this.centralAiService.findAll()
  }

  @Post('central-ai')
  @Roles('ADMIN')
  createCentralAi(@Body() dto: CreateCentralAiDto) {
    return this.centralAiService.create(dto)
  }

  @Patch('central-ai/:id')
  @Roles('ADMIN')
  updateCentralAi(@Param('id') id: string, @Body() dto: UpdateCentralAiDto) {
    return this.centralAiService.update(id, dto)
  }

  @Delete('central-ai/:id')
  @Roles('ADMIN')
  removeCentralAi(@Param('id') id: string) {
    return this.centralAiService.remove(id)
  }

  @Post('central-ai/:id/activate')
  @Roles('ADMIN')
  activateCentralAi(@Param('id') id: string) {
    return this.centralAiService.setActive(id)
  }

  // ─── Banco de Dados (ADMIN only) ──────────────────────────────────────────

  @Get('database/inspect')
  @Roles('ADMIN')
  inspectPhone(@Query('phone') phone: string) {
    return this.databaseService.inspectPhone(phone ?? '')
  }

  @Delete('database/history')
  @Roles('ADMIN')
  clearHistory(@Body() body: { phones: string[]; automationId?: string }) {
    return this.databaseService.clearHistory(body.phones ?? [], body.automationId)
  }

  @Delete('database/logs')
  @Roles('ADMIN')
  clearLogs(@Body() body: { phones: string[] }) {
    return this.databaseService.clearLogs(body.phones ?? [])
  }

  @Post('database/reset')
  @Roles('ADMIN')
  resetLead(@Body() body: { phones: string[] }) {
    return this.databaseService.resetLead(body.phones ?? [])
  }
}
