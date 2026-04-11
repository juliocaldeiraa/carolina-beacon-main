/* eslint-disable @typescript-eslint/no-explicit-any */
// @ts-nocheck
/**
 * Testes unitários — AutomationReplyHandlerService
 *
 * Ambiente 100% simulado: zero banco de dados real, zero WhatsApp, zero leads reais.
 * Todos os serviços externos são mocks em memória.
 *
 * Cenários cobertos:
 *  1. Lead responde no canal primário → IA responde, CRM avança
 *  2. Lead responde no canal FALLBACK → automação encontrada via fallbackChannelIds
 *  3. Formato de phone divergente (Evolution "55119..." vs lead "+119...") → variantes resolvem
 *  4. Opt-out → lead marcado, CRM → Fechado Perdido, IA não responde
 *  5. Lead já em opt_out → silêncio total
 *  6. Lead já converteu → silêncio total
 *  7. IA envia link → CRM → Proposta Enviada, status → link_enviado
 *  8. IA responde sem link → CRM → Qualificado, status → em_conversa
 *  9. Limite de turnos atingido → conversa_encerrada, CRM → Fechado Perdido
 * 10. IA falha → fallback message enviada
 * 11. Lead não encontrado no banco → silêncio (sem crash)
 * 12. Automação não encontrada → silêncio (sem crash)
 * 13. Lead com histórico no canal primário responde no fallback → IA recebe histórico correto
 * 14. Mensagens consecutivas no fallback → histórico acumula (não reseta por canal)
 */

import { describe, it, expect, jest, beforeEach } from '@jest/globals'
import { Test } from '@nestjs/testing'
import { AutomationReplyHandlerService } from './automation-reply-handler.service'
import { PrismaService }          from '@/infrastructure/database/prisma/prisma.service'
import { AiEngineService }        from '@/infrastructure/ai-engine/ai-engine.service'
import { MessageSplitterService } from '@/infrastructure/ai-engine/message-splitter.service'
import { ChannelSendService }     from '@/infrastructure/channel-send/channel-send.service'
import { CrmService }             from '@/features/crm/crm.service'

// ─── Fixtures ───────────────────────────────────────────────────────────────

const CHANNEL_ID_PRIMARY  = 'chan-primary-001'
const CHANNEL_ID_FALLBACK = 'chan-fallback-002'
const AUTOMATION_ID       = 'auto-sofia-001'

const mockAutomation = {
  id:                 AUTOMATION_ID,
  name:               'Sofia - Follow-up Ebook',
  status:             'ACTIVE',
  channelId:          CHANNEL_ID_PRIMARY,
  primaryChannelId:   CHANNEL_ID_PRIMARY,
  fallbackChannelIds: [CHANNEL_ID_FALLBACK],
  aiChannelId:        CHANNEL_ID_PRIMARY,
  linkedAgentId:      'agent-sofia-001',
  aiModel:            null,
  aiPrompt:           null,
  humanHandoffEnabled: false,
  messageTemplates:   ['Olá {nome}!'],
  messageTemplate:    'Olá {nome}!',
  totalReplied:       0,
}

const mockAgent = {
  id:              'agent-sofia-001',
  name:            'Sofia',
  personality:     'Você é Sofia da Escola TOCHA.',
  actionPrompt:    'Responda de forma acolhedora.',
  systemPrompt:    null,
  agentType:       'PASSIVO',
  model:           'claude-haiku-4-5-20251001',
  temperature:     0.7,
  maxTokens:       400,
  historyLimit:    20,
  fallbackEnabled: true,
  fallbackMessage: 'Voltinho já!',
  deletedAt:       null,
}

const mockChannel = {
  id:     CHANNEL_ID_PRIMARY,
  name:   'JRWHATS001',
  type:   'EVOLUTION_API',
  status: 'CONNECTED',
  config: { instanceUrl: 'http://evo', instanceName: 'jrwhats001', apiKey: 'key123' },
  createdAt: new Date(),
  updatedAt: new Date(),
}

// Lead com phone no formato armazenado: "+119XXXXXXXX" (com +, sem 55)
function makeLead(overrides: Record<string, unknown> = {}) {
  return {
    id:               'lead-001',
    nome:             'Maria',
    whatsapp:         '+11987654321',
    whatsappLimpo:    '+11987654321',
    status:           'followup_enviado',
    campanha:         'Ebook Bíblia',
    origem:           'Instagram',
    lista:            null,
    metadata:         null,
    historicoCId:     null,
    mensagemEnviada:  'Olá Maria!',
    converteu:        false,
    dataLinkEnviado:  null,
    ...overrides,
  }
}

// ─── Helpers de mock ─────────────────────────────────────────────────────────

function buildPrismaMock(lead: ReturnType<typeof makeLead> | null, automation = mockAutomation) {
  return {
    automation: {
      findFirst: jest.fn().mockImplementation(({ where }) => {
        // Simula a busca por fallbackChannelIds também
        const channelId = where?.OR?.[0]?.channelId
        const primaryId = where?.OR?.[1]?.primaryChannelId
        const fallbackContains = where?.OR?.[2]?.fallbackChannelIds?.array_contains

        const matches =
          automation.channelId === channelId ||
          automation.primaryChannelId === primaryId ||
          (automation.fallbackChannelIds as string[]).includes(fallbackContains)

        if (!matches) return null
        if (where?.status === 'ACTIVE' && automation.status !== 'ACTIVE') return null
        return automation
      }),
      update: jest.fn().mockResolvedValue(automation),
    },
    leadManyInsta: {
      findFirst: jest.fn().mockResolvedValue(lead),
      update:    jest.fn().mockResolvedValue({ ...lead }),
    },
    channel: {
      findUnique: jest.fn().mockResolvedValue(mockChannel),
    },
    channelAgent: {
      findFirst: jest.fn().mockResolvedValue(null),
    },
    agent: {
      findFirst: jest.fn().mockResolvedValue(mockAgent),
    },
  }
}

async function buildSut(prismaMock: ReturnType<typeof buildPrismaMock>) {
  const sendMock    = { send: jest.fn().mockResolvedValue(undefined), sendTyping: jest.fn().mockResolvedValue(undefined) }
  const aiMock      = { complete: jest.fn().mockResolvedValue({ content: 'Olá! Como posso te ajudar?' }) }
  const splitterMock = { split: jest.fn().mockImplementation((text: string) => Promise.resolve([text])) }
  const crmMock     = { upsertLeadCard: jest.fn().mockResolvedValue(undefined) }

  const module = await Test.createTestingModule({
    providers: [
      AutomationReplyHandlerService,
      { provide: PrismaService,          useValue: prismaMock },
      { provide: ChannelSendService,     useValue: sendMock },
      { provide: AiEngineService,        useValue: aiMock },
      { provide: MessageSplitterService, useValue: splitterMock },
      { provide: CrmService,             useValue: crmMock },
    ],
  }).compile()

  return {
    sut:      module.get(AutomationReplyHandlerService),
    send:     sendMock,
    ai:       aiMock,
    crm:      crmMock,
    splitter: splitterMock,
    prisma:   prismaMock,
  }
}

// ─── Testes ──────────────────────────────────────────────────────────────────

describe('AutomationReplyHandlerService', () => {

  // ── Cenário 1: Canal primário ─────────────────────────────────────────────
  it('Cenário 1 — lead responde no canal primário → AI responde, CRM avança', async () => {
    const lead = makeLead()
    const { sut, send, ai, crm } = await buildSut(buildPrismaMock(lead))

    await sut.handleReply(CHANNEL_ID_PRIMARY, '5511987654321', 'Oi, me conta mais!')

    expect(ai.complete).toHaveBeenCalled()
    expect(send.send).toHaveBeenCalledWith(
      expect.objectContaining({ id: CHANNEL_ID_PRIMARY }),
      '5511987654321',
      expect.any(String),
    )
    expect(crm.upsertLeadCard).toHaveBeenCalledWith(
      expect.objectContaining({ targetStage: 'Respondido' }),
    )
    expect(crm.upsertLeadCard).toHaveBeenCalledWith(
      expect.objectContaining({ targetStage: 'Qualificado' }),
    )
  })

  // ── Cenário 2: Canal FALLBACK ─────────────────────────────────────────────
  it('Cenário 2 — lead responde no canal FALLBACK → automação encontrada via fallbackChannelIds', async () => {
    const lead = makeLead()
    const { sut, send, ai } = await buildSut(buildPrismaMock(lead))

    // Responde em JRWHATS002 (fallback), não no primário
    await sut.handleReply(CHANNEL_ID_FALLBACK, '5511987654321', 'Quero saber mais')

    expect(ai.complete).toHaveBeenCalled()
    expect(send.send).toHaveBeenCalled()
  })

  // ── Cenário 3: Divergência de formato de phone ────────────────────────────
  it('Cenário 3 — Evolution envia "5511987654321", lead tem "+11987654321" → variantes resolvem', async () => {
    // Lead armazenado com + e sem 55 (formato real encontrado no banco)
    const lead = makeLead({ whatsapp: '+11987654321', whatsappLimpo: '+11987654321' })
    const prisma = buildPrismaMock(lead)

    // Garante que a busca usa variantes
    prisma.leadManyInsta.findFirst.mockImplementation(({ where }) => {
      const variants: string[] = where.OR.map((c: any) => c.whatsappLimpo ?? c.whatsapp).filter(Boolean)
      // "+11987654321" deve estar entre as variantes geradas
      return variants.includes('+11987654321') ? lead : null
    })

    const { sut, ai } = await buildSut(prisma)

    // Webhook chega com formato Evolution (sem +, com 55)
    await sut.handleReply(CHANNEL_ID_PRIMARY, '5511987654321', 'Oi!')

    expect(ai.complete).toHaveBeenCalled()
  })

  // ── Cenário 4: Opt-out em tempo real ─────────────────────────────────────
  it('Cenário 4 — lead manda "não quero mais" → opt_out, CRM Fechado Perdido, IA silenciosa', async () => {
    const lead = makeLead()
    const { sut, send, ai, crm, prisma } = await buildSut(buildPrismaMock(lead))

    await sut.handleReply(CHANNEL_ID_PRIMARY, '5511987654321', 'não quero mais')

    expect(ai.complete).not.toHaveBeenCalled()
    expect(send.send).toHaveBeenCalledWith(
      expect.anything(),
      expect.anything(),
      expect.stringContaining('removido'),
    )
    expect(prisma.leadManyInsta.update).toHaveBeenCalledWith(
      expect.objectContaining({ data: expect.objectContaining({ status: 'opt_out' }) }),
    )
    expect(crm.upsertLeadCard).toHaveBeenCalledWith(
      expect.objectContaining({ targetStage: 'Fechado Perdido' }),
    )
  })

  // ── Cenário 5: Lead já em opt_out ─────────────────────────────────────────
  it('Cenário 5 — lead já é opt_out → silêncio total, sem envio, sem CRM', async () => {
    const lead = makeLead({ status: 'opt_out' })
    const { sut, send, ai, crm } = await buildSut(buildPrismaMock(lead))

    await sut.handleReply(CHANNEL_ID_PRIMARY, '5511987654321', 'Oi de novo!')

    expect(ai.complete).not.toHaveBeenCalled()
    expect(send.send).not.toHaveBeenCalled()
    // CRM "Respondido" é chamado antes do guardrail — só verifica que não chamou Qualificado
    expect(crm.upsertLeadCard).not.toHaveBeenCalledWith(
      expect.objectContaining({ targetStage: 'Qualificado' }),
    )
  })

  // ── Cenário 6: Lead convertido ────────────────────────────────────────────
  it('Cenário 6 — lead já converteu → silêncio total', async () => {
    const lead = makeLead({ converteu: true })
    const { sut, send, ai } = await buildSut(buildPrismaMock(lead))

    await sut.handleReply(CHANNEL_ID_PRIMARY, '5511987654321', 'quero mais info')

    expect(ai.complete).not.toHaveBeenCalled()
    expect(send.send).not.toHaveBeenCalled()
  })

  // ── Cenário 7: IA envia link → Proposta Enviada ───────────────────────────
  it('Cenário 7 — IA responde com link → CRM Proposta Enviada, status link_enviado', async () => {
    const lead = makeLead()
    const { sut, ai, crm, prisma } = await buildSut(buildPrismaMock(lead))
    ai.complete.mockResolvedValue({ content: 'Veja aqui: https://escolatocha.com/db-iatocha' })

    await sut.handleReply(CHANNEL_ID_PRIMARY, '5511987654321', 'quero participar')

    expect(crm.upsertLeadCard).toHaveBeenCalledWith(
      expect.objectContaining({ targetStage: 'Proposta Enviada' }),
    )
    expect(prisma.leadManyInsta.update).toHaveBeenCalledWith(
      expect.objectContaining({ data: expect.objectContaining({ status: 'link_enviado' }) }),
    )
  })

  // ── Cenário 8: IA responde sem link → Qualificado ─────────────────────────
  it('Cenário 8 — IA responde sem link → CRM Qualificado, status em_conversa', async () => {
    const lead = makeLead()
    const { sut, crm, prisma } = await buildSut(buildPrismaMock(lead))

    await sut.handleReply(CHANNEL_ID_PRIMARY, '5511987654321', 'me fala mais sobre o evento')

    expect(crm.upsertLeadCard).toHaveBeenCalledWith(
      expect.objectContaining({ targetStage: 'Qualificado' }),
    )
    expect(prisma.leadManyInsta.update).toHaveBeenCalledWith(
      expect.objectContaining({ data: expect.objectContaining({ status: 'em_conversa' }) }),
    )
  })

  // ── Cenário 9: Limite de turnos ───────────────────────────────────────────
  it('Cenário 9 — 16+ turnos no histórico → conversa_encerrada, CRM Fechado Perdido', async () => {
    const history16 = Array.from({ length: 16 }, (_, i) => ({
      role:      i % 2 === 0 ? 'user' : 'assistant',
      content:   `Mensagem ${i}`,
      timestamp: new Date().toISOString(),
    }))
    const lead = makeLead({
      // historicoCId scoped por automationId
      historicoCId: { [AUTOMATION_ID]: history16 },
    })
    const { sut, send, ai, crm, prisma } = await buildSut(buildPrismaMock(lead))

    await sut.handleReply(CHANNEL_ID_PRIMARY, '5511987654321', 'mais uma mensagem')

    expect(ai.complete).not.toHaveBeenCalled()
    expect(send.send).toHaveBeenCalled() // mensagem de encerramento
    expect(prisma.leadManyInsta.update).toHaveBeenCalledWith(
      expect.objectContaining({ data: expect.objectContaining({ status: 'conversa_encerrada' }) }),
    )
    expect(crm.upsertLeadCard).toHaveBeenCalledWith(
      expect.objectContaining({ targetStage: 'Fechado Perdido' }),
    )
  })

  // ── Cenário 10: IA falha → fallback ──────────────────────────────────────
  it('Cenário 10 — IA lança erro → fallback message enviada', async () => {
    const lead = makeLead()
    const { sut, send, ai } = await buildSut(buildPrismaMock(lead))
    ai.complete.mockRejectedValue(new Error('Timeout'))

    await sut.handleReply(CHANNEL_ID_PRIMARY, '5511987654321', 'Oi!')

    expect(send.send).toHaveBeenCalledWith(
      expect.anything(),
      expect.anything(),
      expect.stringContaining('Voltinho'),
    )
  })

  // ── Cenário 11: Lead não encontrado ──────────────────────────────────────
  it('Cenário 11 — lead não existe no banco → silêncio, sem crash', async () => {
    const { sut, send, ai } = await buildSut(buildPrismaMock(null))

    await expect(
      sut.handleReply(CHANNEL_ID_PRIMARY, '5511987654321', 'Oi!')
    ).resolves.not.toThrow()

    expect(ai.complete).not.toHaveBeenCalled()
    expect(send.send).not.toHaveBeenCalled()
  })

  // ── Cenário 12: Automação não encontrada ──────────────────────────────────
  it('Cenário 12 — canal sem automação ativa → silêncio, sem crash', async () => {
    const lead = makeLead()
    const prisma = buildPrismaMock(lead, { ...mockAutomation, status: 'INACTIVE' })
    const { sut, send, ai } = await buildSut(prisma)

    await expect(
      sut.handleReply('chan-sem-automacao', '5511987654321', 'Oi!')
    ).resolves.not.toThrow()

    expect(ai.complete).not.toHaveBeenCalled()
    expect(send.send).not.toHaveBeenCalled()
  })

  // ── Cenário 13: Cross-channel history preservation ────────────────────────
  it('Cenário 13 — lead tinha histórico no canal primário, responde no fallback → IA recebe histórico correto', async () => {
    const existingHistory = [
      { role: 'user',      content: 'Olá, vi o ebook!',    timestamp: new Date(Date.now() - 60_000).toISOString() },
      { role: 'assistant', content: 'Olá Maria! Que bom!', timestamp: new Date(Date.now() - 55_000).toISOString() },
    ]
    const lead = makeLead({ historicoCId: { [AUTOMATION_ID]: existingHistory }, status: 'em_conversa' })
    const { sut, ai, prisma } = await buildSut(buildPrismaMock(lead))

    await sut.handleReply(CHANNEL_ID_FALLBACK, '5511987654321', 'Quero saber mais sobre o evento')

    expect(ai.complete).toHaveBeenCalled()
    const callArgs = ai.complete.mock.calls[0][0]
    // 2 turnos anteriores + mensagem atual = 3
    expect(callArgs.messages).toHaveLength(3)
    expect(callArgs.messages[0]).toMatchObject({ role: 'user',      content: 'Olá, vi o ebook!' })
    expect(callArgs.messages[1]).toMatchObject({ role: 'assistant', content: 'Olá Maria! Que bom!' })
    expect(callArgs.messages[2]).toMatchObject({ role: 'user',      content: 'Quero saber mais sobre o evento' })

    // Histórico salvo deve ter 4 entradas (2 anteriores + nova user + nova assistant)
    const savedHistory = (prisma.leadManyInsta.update.mock.calls[0][0] as any).data.historicoCId[AUTOMATION_ID]
    expect(savedHistory).toHaveLength(4)
  })

  // ── Cenário 14: Histórico acumula no fallback (não reseta) ────────────────
  it('Cenário 14 — mensagens consecutivas no fallback → histórico acumula, não reseta', async () => {
    const historyAfterFirst = [
      { role: 'user',      content: 'Olá via fallback!',          timestamp: new Date(Date.now() - 120_000).toISOString() },
      { role: 'assistant', content: 'Olá! Como posso te ajudar?', timestamp: new Date(Date.now() - 115_000).toISOString() },
    ]
    const lead = makeLead({ historicoCId: { [AUTOMATION_ID]: historyAfterFirst }, status: 'em_conversa' })
    const { sut, ai, prisma } = await buildSut(buildPrismaMock(lead))

    await sut.handleReply(CHANNEL_ID_FALLBACK, '5511987654321', 'Pode me passar o link do evento?')

    expect(ai.complete).toHaveBeenCalled()
    const savedHistoricoCId = (prisma.leadManyInsta.update.mock.calls[0][0] as any).data.historicoCId
    const savedHistory = savedHistoricoCId[AUTOMATION_ID]

    // 4 entradas: 2 anteriores + nova user + nova assistant
    expect(savedHistory).toHaveLength(4)
    // Chave deve ser automationId — NÃO channelId
    expect(Object.keys(savedHistoricoCId)).toEqual([AUTOMATION_ID])
    expect(Object.keys(savedHistoricoCId)).not.toContain(CHANNEL_ID_FALLBACK)
  })

})
