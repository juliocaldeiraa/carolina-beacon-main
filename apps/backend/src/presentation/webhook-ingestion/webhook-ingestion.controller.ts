/**
 * WebhookIngestionController — Endpoint público para receber mensagens dos canais
 *
 * POST /inbound/:channelId        — sem autenticação, retorna 200 imediato
 * GET  /inbound-logs              — lista execuções recentes (requer JWT)
 * POST /inbound-logs/:id/explain  — análise do log por IA Central (requer JWT)
 */

import { Controller, Post, Get, Param, Body, Query, HttpCode, UseGuards, Logger } from '@nestjs/common'
import { WebhookIngestionService } from '@/features/webhook-ingestion/webhook-ingestion.service'
import { AiEngineService }         from '@/infrastructure/ai-engine/ai-engine.service'
import { PrismaService }           from '@/infrastructure/database/prisma/prisma.service'
import { JwtGuard }                from '@/shared/guards/jwt.guard'
import type { Channel, ChannelType, ChannelConfig } from '@/core/entities/Channel'

@Controller()
export class WebhookIngestionController {
  private readonly logger = new Logger(WebhookIngestionController.name)
  private get tenantId() { return process.env.DEFAULT_TENANT_ID! }

  constructor(
    private readonly svc:      WebhookIngestionService,
    private readonly prisma:   PrismaService,
    private readonly aiEngine: AiEngineService,
  ) {}

  // ─── Inbound webhook (sem auth) ─────────────────────────────────────────────

  @Post('inbound/:channelId')
  @HttpCode(200)
  async receive(
    @Param('channelId') channelId: string,
    @Body() payload: unknown,
  ): Promise<{ ok: boolean }> {
    // Cria log inicial (fire & forget) com rawPayload — service atualiza com dados do contato
    const rawLogPromise = this.prisma.ingestionLog.create({
      data: { tenantId: this.tenantId, channelId, status: 'received', rawPayload: payload as object },
    }).catch(() => null)

    // Inicia ingestão assíncrona após log criado (para ter o ID disponível)
    rawLogPromise.then((rawLog) => {
      this.svc.ingest(channelId, payload, rawLog?.id).catch((err) =>
        this.logger.error(`[ingest] erro não tratado canal=${channelId}: ${err}`)
      )
    })

    this.logger.log(`Webhook recebido: canal ${channelId}`)
    return { ok: true }
  }

  // ─── Ingestion logs (com auth) ───────────────────────────────────────────────

  @UseGuards(JwtGuard)
  @Get('inbound-logs')
  async getLogs(
    @Query('channelId') channelId?: string,
    @Query('status')    status?: string,
    @Query('search')    search?: string,
    @Query('limit')     limit?: string,
  ) {
    const take = Math.min(Number(limit ?? 50), 200)
    return this.prisma.ingestionLog.findMany({
      where: {
        tenantId: this.tenantId,
        ...(channelId ? { channelId } : {}),
        ...(status && status !== 'all' ? { status } : {}),
        ...(search ? {
          OR: [
            { contactPhone: { contains: search } },
            { contactName:  { contains: search, mode: 'insensitive' } },
          ],
        } : {}),
      },
      orderBy: { createdAt: 'desc' },
      take,
    })
  }

  // ─── Análise por IA Central de um log específico ────────────────────────────

  @UseGuards(JwtGuard)
  @Post('inbound-logs/:id/explain')
  async explainLog(@Param('id') id: string): Promise<{ explanation: string }> {
    const [log, centralAi] = await Promise.all([
      this.prisma.ingestionLog.findUnique({ where: { id } }),
      this.prisma.centralAiConfig.findFirst({
        where: { tenantId: this.tenantId, isActive: true },
      }),
    ])

    if (!log) return { explanation: 'Log não encontrado.' }
    if (!centralAi) return { explanation: 'Nenhuma IA Central configurada. Configure em Configurações → IA Central.' }

    // Busca configuração do canal-agente para contexto completo
    const channelAgent = log.channelId
      ? await this.prisma.channelAgent.findFirst({ where: { channelId: log.channelId } })
      : null
    const channelAgentAgent = channelAgent?.agentId
      ? await this.prisma.agent.findUnique({ where: { id: channelAgent.agentId } })
      : null

    const STATUS_LABELS: Record<string, string> = {
      received:       'Recebido (aguardando processamento)',
      debounced:      'Agrupado com outras mensagens rápidas do mesmo contato',
      processing:     'Em processamento pela IA',
      completed:      'Concluído com sucesso — resposta enviada ao contato',
      no_agent:       'Nenhum agente de IA vinculado ao canal',
      no_channel:     'Canal não encontrado no sistema',
      ai_error:       'Erro na chamada da IA',
      parse_error:    'Erro ao interpretar o payload do webhook',
      send_error:     'Erro ao enviar resposta ao contato',
      failed:         'Falha geral no pipeline',
      human_takeover: 'Conversa em atendimento humano (IA pausada)',
      automation:     'Interceptado pelo sistema de automação',
      ignored_group:  'Mensagem de grupo ignorada (grupos desativados neste canal)',
      ignored_trigger:'Mensagem ignorada (nenhuma palavra-gatilho encontrada)',
      rate_limited:   'Contato bloqueado temporariamente por excesso de mensagens',
    }

    // Monta seção de configuração do canal para contexto da IA
    let channelConfigSection = ''
    if (channelAgent) {
      const keywords = Array.isArray(channelAgent.triggerKeywords) ? channelAgent.triggerKeywords : []
      const keywordsStr = keywords.length > 0 ? keywords.join(', ') : 'nenhuma definida'
      channelConfigSection = `
Configuração do canal-agente:
- Agente vinculado: ${channelAgentAgent?.name ?? 'desconhecido'}
- Canal ativo: ${channelAgent.isActive ? 'Sim' : 'Não (canal desativado)'}
- Responde grupos do WhatsApp: ${channelAgent.allowGroups ? 'Sim' : 'Não (grupos bloqueados)'}
- Modo de ativação da IA: ${channelAgent.triggerMode === 'keywords' ? `Apenas por palavras-gatilho (${keywordsStr})` : 'Sempre (responde toda mensagem)'}
- Debounce (agrupa msgs rápidas): ${channelAgent.debounceMs ?? 3000}ms
- Delay antes de enviar: ${channelAgent.sendDelayMs ?? 0}ms
- Limite de turnos por conversa: ${channelAgentAgent?.limitTurns ? `Sim (máx ${channelAgentAgent.maxTurns} trocas)` : 'Não'}
- Mensagem de fallback ativa: ${channelAgentAgent?.fallbackEnabled ? 'Sim' : 'Não'}`
    }

    const isGroup = log.contactPhone?.includes('@g.us') || log.contactPhone?.endsWith('g.us') || false

    const prompt = `Você é um assistente técnico do sistema Beacon (plataforma de atendimento com IA via WhatsApp).
Analise este log de execução e explique em português simples, como se fosse para alguém não técnico.
Use a configuração do canal para contextualizar o comportamento — especialmente quando o status indica que a mensagem foi ignorada ou não respondida.

DADOS DA MENSAGEM:
Canal: ${log.channelName ?? log.channelId ?? 'desconhecido'}
Telefone do contato: ${log.contactPhone ?? 'não identificado'}${isGroup ? ' ⚠️ (número de GRUPO do WhatsApp)' : ''}
Nome do contato: ${log.contactName ?? 'não identificado'}
Mensagem recebida: ${log.messagePreview ?? '(sem prévia de mensagem)'}
Status final: ${STATUS_LABELS[log.status] ?? log.status}
Etapa do pipeline: ${log.step ?? 'não registrada'}
Modelo de IA usado: ${log.model ?? 'nenhum'}
Tempo de resposta: ${log.latencyMs != null ? `${log.latencyMs}ms (${(log.latencyMs / 1000).toFixed(1)}s)` : 'não medido'}
Mensagem de erro: ${log.errorMsg ?? 'nenhum erro'}
${channelConfigSection}

Responda de forma direta em exatamente 3 tópicos:
**1. O que aconteceu:** (explique o que ocorreu com essa mensagem, incluindo o motivo se foi ignorada/bloqueada por alguma configuração)
**2. Normal ou problema?** (avalie se o comportamento é esperado dado o contexto e as configurações, ou se indica algo errado)
**3. O que fazer:** (ação recomendada com instruções claras de onde mudar no painel, ou "Nenhuma ação necessária" se estiver tudo ok)`

    try {
      const result = await this.aiEngine.complete({
        messages:    [{ role: 'user', content: prompt }],
        model:       centralAi.model,
        temperature: 0.2,
        maxTokens:   500,
      })
      return { explanation: result.content }
    } catch (err) {
      this.logger.error(`[explainLog] falha na IA Central: ${err}`)
      return { explanation: 'Não foi possível gerar a análise. Verifique se a IA Central está configurada corretamente.' }
    }
  }

  // ─── Diagnóstico: executa pipeline completo e retorna resultado como JSON ────

  @UseGuards(JwtGuard)
  @Post('debug/pipeline-test')
  async pipelineTest(
    @Body() body: { channelId: string; phone: string; text: string },
  ): Promise<object> {
    const { channelId, phone, text } = body
    const startMs = Date.now()

    try {
      const channelRow = await this.prisma.channel.findUnique({ where: { id: channelId } })
      if (!channelRow) {
        return { success: false, step: 'channel_lookup', error: `Canal ${channelId} não encontrado` }
      }

      const channel: Channel = {
        id:        channelRow.id,
        name:      channelRow.name,
        type:      channelRow.type as ChannelType,
        status:    channelRow.status as Channel['status'],
        config:    (channelRow.config ?? {}) as ChannelConfig,
        createdAt: channelRow.createdAt,
        updatedAt: channelRow.updatedAt,
      }

      const logId = await this.prisma.ingestionLog.create({
        data: {
          tenantId:       this.tenantId,
          channelId,
          channelName:    channel.name,
          contactPhone:   phone,
          contactName:    'debug-test',
          messagePreview: text.substring(0, 120),
          status:         'received',
          step:           'debug_endpoint',
        },
      }).then(l => l.id).catch(() => '')

      await this.svc.runProcessMessage(channelId, phone, 'debug-test', text, channel, logId)

      const log = logId
        ? await this.prisma.ingestionLog.findUnique({ where: { id: logId } })
        : null

      return {
        success:   true,
        latencyMs: Date.now() - startMs,
        logId,
        status:    log?.status,
        step:      log?.step,
        model:     log?.model,
        errorMsg:  log?.errorMsg,
      }
    } catch (err) {
      this.logger.error(`[debug/pipeline-test] erro: ${err}`)
      return { success: false, latencyMs: Date.now() - startMs, error: String(err) }
    }
  }
}
