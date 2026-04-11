import {
  Controller, Get, Post, Patch, Delete,
  Query, Body, Param,
  UseGuards, BadRequestException,
} from '@nestjs/common'
import { JwtGuard }      from '@/shared/guards/jwt.guard'
import { RolesGuard }    from '@/shared/guards/roles.guard'
import { Roles }         from '@/shared/decorators/roles.decorator'
import { LeadsService }  from '@/features/vendedor/leads.service'

@UseGuards(JwtGuard, RolesGuard)
@Controller('leads')
export class LeadsController {
  constructor(private readonly svc: LeadsService) {}

  // ─── Listagem paginada ──────────────────────────────────────────────────

  @Get()
  @Roles('ADMIN', 'EQUIPE')
  list(
    @Query('page')     page?:     string,
    @Query('limit')    limit?:    string,
    @Query('search')   search?:   string,
    @Query('status')   status?:   string,
    @Query('campanha') campanha?: string,
    @Query('lista')    lista?:    string,
  ) {
    return this.svc.list({
      page:     page     ? parseInt(page, 10)  : 1,
      limit:    limit    ? parseInt(limit, 10) : 50,
      search, status, campanha, lista,
    })
  }

  // ─── Export completo ────────────────────────────────────────────────────

  @Get('export')
  @Roles('ADMIN', 'EQUIPE')
  exportAll(
    @Query('search')   search?:   string,
    @Query('status')   status?:   string,
    @Query('campanha') campanha?: string,
    @Query('lista')    lista?:    string,
  ) {
    return this.svc.exportAll({ search, status, campanha, lista })
  }

  // ─── Import CSV ─────────────────────────────────────────────────────────

  @Post('import')
  @Roles('ADMIN', 'EQUIPE')
  import(@Body() body: { rows: any[]; lista?: string }) {
    if (!Array.isArray(body?.rows)) throw new BadRequestException('rows obrigatório')
    return this.svc.import(body.rows, body.lista)
  }

  // ─── Filtros ────────────────────────────────────────────────────────────

  @Get('filters')
  @Roles('ADMIN', 'EQUIPE')
  async filters() {
    const [statuses, campanhas, listas] = await Promise.all([
      this.svc.distinctStatuses(),
      this.svc.distinctCampanhas(),
      this.svc.distinctListas(),
    ])
    return { statuses, campanhas, listas }
  }

  // ─── Conversa ───────────────────────────────────────────────────────────

  @Get('conversation')
  @Roles('ADMIN', 'EQUIPE')
  conversation(@Query('phone') phone?: string) {
    if (!phone?.trim()) throw new BadRequestException('phone obrigatório')
    return this.svc.getConversation(phone.trim())
  }

  // ─── Field Defs ─────────────────────────────────────────────────────────

  @Get('field-defs')
  @Roles('ADMIN', 'EQUIPE')
  listFieldDefs() {
    return this.svc.listFieldDefs()
  }

  @Post('field-defs')
  @Roles('ADMIN')
  createFieldDef(@Body() body: { key: string; label: string; fieldType?: string }) {
    if (!body?.key?.trim() || !body?.label?.trim()) {
      throw new BadRequestException('key e label obrigatórios')
    }
    return this.svc.createFieldDef(body)
  }

  @Delete('field-defs/:id')
  @Roles('ADMIN')
  deleteFieldDef(@Param('id') id: string) {
    return this.svc.deleteFieldDef(id)
  }

  // ─── Patch lead ─────────────────────────────────────────────────────────

  @Patch(':id')
  @Roles('ADMIN', 'EQUIPE')
  patchLead(
    @Param('id') id: string,
    @Body() body: { status?: string; lista?: string; notas?: string; metadata?: Record<string, unknown> },
  ) {
    return this.svc.patchLead(id, body)
  }
}
