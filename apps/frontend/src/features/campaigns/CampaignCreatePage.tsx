/**
 * CampaignCreatePage — Wizard de criação de campanha
 *
 * Passo 1: Configurações + Mensagem (cria a campanha ao avançar)
 * Passo 2: Upload de contatos (opcional, pode fazer depois)
 * Passo 3: Confirmação
 */

import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useMutation, useQuery } from '@tanstack/react-query'
import {
  ArrowLeft, ArrowRight, Check, Upload, Loader2,
  FileText, AlertCircle, CheckCircle,
} from 'lucide-react'
import { campaignsApi } from '@/services/campaigns-api'
import { api } from '@/services/api'
import { SpintextEditor } from './SpintextEditor'

type Step = 1 | 2 | 3

interface FormState {
  name:             string
  channelId:        string
  agentId:          string
  delayMinSec:      number
  delayMaxSec:      number
  rotationMode:     'RANDOM' | 'SEQUENTIAL'
  varLabels:        string[]
  variations:       string[][]
  scheduleEnabled:  boolean
  scheduleStartHour: number
  scheduleEndHour:  number
  scheduleDays:     number[]
}

const DAY_LABELS = ['Dom', 'Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb']

function StepIndicator({ step, current, labels }: { step: number; current: Step; labels: string[] }) {
  const done   = current > step
  const active = current === step
  return (
    <div className={`flex items-center gap-2 text-sm font-medium ${
      done ? 'text-green-600' : active ? 'text-beacon-primary' : 'text-gray-400'
    }`}>
      <div className={`w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold
        ${done ? 'bg-green-100 text-green-600' : active ? 'bg-orange-100 text-beacon-primary' : 'bg-gray-100 text-gray-400'}
      `}>
        {done ? <Check className="w-4 h-4" /> : step}
      </div>
      <span>{labels[step - 1]}</span>
    </div>
  )
}

export function CampaignCreatePage() {
  const navigate = useNavigate()
  const [step, setStep]           = useState<Step>(1)
  const [createdId, setCreatedId] = useState<string | null>(null)
  const [uploadFile, setUploadFile]     = useState<File | null>(null)
  const [uploadResult, setUploadResult] = useState<{ imported: number; skipped: number } | null>(null)
  const [activeVarIdx, setActiveVarIdx] = useState(0)

  const [form, setForm] = useState<FormState>({
    name:             '',
    channelId:        '',
    agentId:          '',
    delayMinSec:      120,
    delayMaxSec:      240,
    rotationMode:     'RANDOM',
    varLabels:        ['', '', '', '', ''],
    variations:       [['']],
    scheduleEnabled:  false,
    scheduleStartHour: 8,
    scheduleEndHour:  18,
    scheduleDays:     [1,2,3,4,5],
  })

  const { data: channels = [] } = useQuery({
    queryKey: ['channels'],
    queryFn:  () => api.get<any[]>('/channels').then((r) => r.data),
  })
  const connectedInstances = channels.filter((i: any) => i.status === 'CONNECTED')

  const { data: agents = [] } = useQuery({
    queryKey: ['agents'],
    queryFn:  () => api.get<any[]>('/agents').then((r) => r.data),
  })
  const activeAgents = agents.filter((a: any) => a.status === 'ACTIVE')

  const createMutation = useMutation({
    mutationFn: () => campaignsApi.create({
      name:              form.name.trim(),
      channelId:         form.channelId || undefined,
      agentId:           form.agentId || undefined,
      delayMinSec:       form.delayMinSec,
      delayMaxSec:       form.delayMaxSec,
      rotationMode:      form.rotationMode,
      varLabels:         form.varLabels,
      initialVariations: form.variations
        .map((parts) => parts.filter((p) => p.trim()))
        .filter((parts) => parts.length > 0),
      scheduleEnabled:   form.scheduleEnabled,
      scheduleStartHour: form.scheduleStartHour,
      scheduleEndHour:   form.scheduleEndHour,
      scheduleDays:      form.scheduleDays,
    }),
    onSuccess: (campaign) => {
      setCreatedId(campaign.id)
      setStep(2)
    },
  })

  const importMutation = useMutation({
    mutationFn: (file: File) => campaignsApi.importLeads(createdId!, file),
    onSuccess: (result) => {
      setUploadResult({ imported: result.imported, skipped: result.skipped })
    },
  })

  // Validações passo 1
  const hasVariation = form.variations.some((parts) => parts.some((p) => p.trim().length > 0))
  const step1Valid   = form.name.trim().length > 0 && form.delayMinSec >= 120 && hasVariation

  const handleStep1Next = () => {
    if (!step1Valid) return
    createMutation.mutate()
  }

  const handleImportSuccess = () => setStep(3)

  return (
    <div className="max-w-2xl mx-auto space-y-6">
      {/* Back */}
      <button
        onClick={() => navigate('/campaigns')}
        className="flex items-center gap-2 text-sm text-gray-500 hover:text-gray-700"
      >
        <ArrowLeft className="w-4 h-4" />
        Voltar às campanhas
      </button>

      {/* Steps */}
      <div className="flex items-center gap-4">
        <StepIndicator step={1} current={step} labels={['Configurar', 'Contatos', 'Pronto']} />
        <div className="flex-1 h-px bg-gray-200" />
        <StepIndicator step={2} current={step} labels={['Configurar', 'Contatos', 'Pronto']} />
        <div className="flex-1 h-px bg-gray-200" />
        <StepIndicator step={3} current={step} labels={['Configurar', 'Contatos', 'Pronto']} />
      </div>

      {/* ─── Passo 1: Configurações + Mensagem ─── */}
      {step === 1 && (
        <div className="bg-white border border-gray-200 rounded-xl p-6 space-y-6 shadow-sm">
          <h2 className="font-semibold text-gray-900 text-lg">Configurações da campanha</h2>

          {/* Nome */}
          <div className="space-y-1.5">
            <label className="text-sm font-medium text-gray-700">Nome da campanha *</label>
            <input
              type="text"
              value={form.name}
              onChange={(e) => setForm({ ...form, name: e.target.value })}
              placeholder="Ex: Promoção Junho 2024"
              className="w-full border border-gray-200 rounded-lg px-3 py-2.5 text-sm
                         focus:outline-none focus:ring-2 focus:ring-beacon-primary"
            />
          </div>

          {/* Instância */}
          <div className="space-y-1.5">
            <label className="text-sm font-medium text-gray-700">Instância WhatsApp</label>
            <select
              value={form.channelId}
              onChange={(e) => setForm({ ...form, channelId: e.target.value })}
              className="w-full border border-gray-200 rounded-lg px-3 py-2.5 text-sm bg-white
                         focus:outline-none focus:ring-2 focus:ring-beacon-primary"
            >
              <option value="">Selecionar depois</option>
              {connectedInstances.map((i) => (
                <option key={i.id} value={i.id}>
                  {i.name}{i.phoneNumber ? ` (+${i.phoneNumber})` : ''}
                </option>
              ))}
            </select>
            {connectedInstances.length === 0 && (
              <p className="text-xs text-amber-600">Nenhuma instância conectada. Você pode definir depois.</p>
            )}
          </div>

          {/* Agente IA (opcional) */}
          <div className="space-y-1.5">
            <label className="text-sm font-medium text-gray-700">Agente IA (opcional)</label>
            <select
              value={form.agentId}
              onChange={(e) => setForm({ ...form, agentId: e.target.value })}
              className="w-full border border-gray-200 rounded-lg px-3 py-2.5 text-sm bg-white
                         focus:outline-none focus:ring-2 focus:ring-beacon-primary"
            >
              <option value="">Sem agente — apenas disparo</option>
              {activeAgents.map((a: any) => (
                <option key={a.id} value={a.id}>
                  {a.name} ({a.model})
                </option>
              ))}
            </select>
            <p className="text-xs text-gray-400">
              Com agente vinculado, a IA responde automaticamente quando o lead responder.
            </p>
          </div>

          {/* Delays */}
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-1.5">
              <label className="text-sm font-medium text-gray-700">Delay mínimo (seg) *</label>
              <input
                type="number"
                min={120}
                value={form.delayMinSec}
                onChange={(e) => setForm({ ...form, delayMinSec: Number(e.target.value) })}
                className="w-full border border-gray-200 rounded-lg px-3 py-2.5 text-sm
                           focus:outline-none focus:ring-2 focus:ring-beacon-primary"
              />
              {form.delayMinSec < 120 && (
                <p className="text-xs text-red-500">Mínimo: 120 segundos</p>
              )}
            </div>
            <div className="space-y-1.5">
              <label className="text-sm font-medium text-gray-700">Delay máximo (seg) *</label>
              <input
                type="number"
                min={form.delayMinSec}
                value={form.delayMaxSec}
                onChange={(e) => setForm({ ...form, delayMaxSec: Number(e.target.value) })}
                className="w-full border border-gray-200 rounded-lg px-3 py-2.5 text-sm
                           focus:outline-none focus:ring-2 focus:ring-beacon-primary"
              />
            </div>
          </div>

          {/* Janela de horário comercial */}
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-gray-700">Horário de disparo</p>
                <p className="text-xs text-gray-400 mt-0.5">Mensagens só serão enviadas dentro da janela configurada</p>
              </div>
              <button
                type="button"
                onClick={() => setForm(f => ({ ...f, scheduleEnabled: !f.scheduleEnabled }))}
                className={`relative w-10 h-5 rounded-full transition-colors ${form.scheduleEnabled ? 'bg-beacon-primary' : 'bg-gray-200'}`}
              >
                <span className={`absolute top-0.5 w-4 h-4 rounded-full bg-white shadow transition-all ${form.scheduleEnabled ? 'left-5' : 'left-0.5'}`} />
              </button>
            </div>
            {form.scheduleEnabled && (
              <div className="space-y-3 pl-1">
                <div className="space-y-1.5">
                  <label className="text-xs font-medium text-gray-600">Dias permitidos</label>
                  <div className="flex gap-1.5">
                    {DAY_LABELS.map((label, idx) => {
                      const active = form.scheduleDays.includes(idx)
                      return (
                        <button
                          key={idx}
                          type="button"
                          onClick={() => {
                            const next = active
                              ? form.scheduleDays.filter(d => d !== idx)
                              : [...form.scheduleDays, idx].sort()
                            setForm(f => ({ ...f, scheduleDays: next }))
                          }}
                          className={`w-9 h-9 rounded-lg text-xs font-semibold transition-colors ${
                            active ? 'bg-beacon-primary text-white' : 'bg-gray-100 text-gray-500 hover:bg-gray-200'
                          }`}
                        >
                          {label}
                        </button>
                      )
                    })}
                  </div>
                </div>
                <div className="flex items-center gap-3">
                  <div className="space-y-1 flex-1">
                    <label className="text-xs font-medium text-gray-600">De</label>
                    <select
                      value={form.scheduleStartHour}
                      onChange={e => setForm(f => ({ ...f, scheduleStartHour: Number(e.target.value) }))}
                      className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-beacon-primary"
                    >
                      {Array.from({length: 24}, (_, h) => (
                        <option key={h} value={h}>{String(h).padStart(2,'0')}:00</option>
                      ))}
                    </select>
                  </div>
                  <div className="space-y-1 flex-1">
                    <label className="text-xs font-medium text-gray-600">Até</label>
                    <select
                      value={form.scheduleEndHour}
                      onChange={e => setForm(f => ({ ...f, scheduleEndHour: Number(e.target.value) }))}
                      className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-beacon-primary"
                    >
                      {Array.from({length: 24}, (_, h) => (
                        <option key={h+1} value={h+1}>{String(h+1).padStart(2,'0')}:00</option>
                      ))}
                    </select>
                  </div>
                </div>
              </div>
            )}
          </div>

          {/* Modo de variações */}
          <div className="space-y-1.5">
            <label className="text-sm font-medium text-gray-700">Modo de variações</label>
            <div className="flex gap-3">
              {(['RANDOM', 'SEQUENTIAL'] as const).map((mode) => (
                <button
                  key={mode}
                  type="button"
                  onClick={() => setForm({ ...form, rotationMode: mode })}
                  className={`flex-1 py-2 px-3 rounded-lg text-sm font-medium border transition-colors ${
                    form.rotationMode === mode
                      ? 'bg-beacon-primary text-white border-beacon-primary'
                      : 'bg-white text-gray-600 border-gray-200 hover:border-gray-300'
                  }`}
                >
                  {mode === 'RANDOM' ? 'Aleatório' : 'Sequencial'}
                </button>
              ))}
            </div>
          </div>

          {/* ─── Rótulos das variáveis ─── */}
          <div className="space-y-3">
            <div>
              <p className="text-sm font-medium text-gray-700">Rótulos das variáveis</p>
              <p className="text-xs text-gray-400 mt-0.5">
                Nomeie cada variável antes de escrever a mensagem.
                Ex: <span className="font-mono">{'{{1}}'}</span> = Nome,{' '}
                <span className="font-mono">{'{{2}}'}</span> = Empresa.
                Esses nomes guiarão o preenchimento da sua planilha.
              </p>
            </div>
            <div className="grid grid-cols-1 gap-2">
              {([1, 2, 3, 4, 5] as const).map((i) => (
                <div key={i} className="flex items-center gap-2">
                  <span className="text-xs font-mono text-gray-400 w-8 shrink-0 text-right">{`{{${i}}}`}</span>
                  <input
                    type="text"
                    value={form.varLabels[i - 1]}
                    onChange={(e) => {
                      const next = [...form.varLabels]
                      next[i - 1] = e.target.value
                      setForm({ ...form, varLabels: next })
                    }}
                    placeholder={
                      i === 1 ? 'Ex: Nome'    :
                      i === 2 ? 'Ex: Empresa' :
                      i === 3 ? 'Ex: Cargo'   :
                      `Variável ${i}`
                    }
                    className="flex-1 border border-gray-200 rounded-lg px-3 py-2 text-sm
                               focus:outline-none focus:ring-2 focus:ring-beacon-primary"
                  />
                </div>
              ))}
            </div>
          </div>

          {/* Divisor */}
          <hr className="border-gray-100" />

          {/* Editor de mensagem */}
          <SpintextEditor
            variations={form.variations}
            onChange={(v) => setForm({ ...form, variations: v })}
            activeIdx={activeVarIdx}
            onActiveChange={setActiveVarIdx}
            label="Mensagem inicial *"
          />

          {createMutation.isError && (
            <p className="text-sm text-red-600 flex items-center gap-1.5">
              <AlertCircle className="w-4 h-4" />
              {(createMutation.error as any)?.response?.data?.message ?? 'Erro ao criar campanha'}
            </p>
          )}

          <div className="flex justify-end">
            <button
              onClick={handleStep1Next}
              disabled={createMutation.isPending || !step1Valid}
              className="flex items-center gap-2 px-5 py-2.5 bg-beacon-primary text-white rounded-lg
                         text-sm font-medium hover:bg-beacon-hover disabled:opacity-50 transition-colors"
            >
              {createMutation.isPending && <Loader2 className="w-4 h-4 animate-spin" />}
              Próximo
              <ArrowRight className="w-4 h-4" />
            </button>
          </div>
        </div>
      )}

      {/* ─── Passo 2: Upload de contatos ─── */}
      {step === 2 && (
        <div className="bg-white border border-gray-200 rounded-xl p-6 space-y-5 shadow-sm">
          <div>
            <h2 className="font-semibold text-gray-900 text-lg">Importar contatos</h2>
            <p className="text-sm text-gray-500 mt-1">
              Formatos aceitos: CSV, XLS, XLSX.
              Coluna obrigatória: <code className="text-xs bg-gray-100 px-1 py-0.5 rounded">telefone</code>.
              Variáveis opcionais: <code className="text-xs bg-gray-100 px-1 py-0.5 rounded">var1</code>–<code className="text-xs bg-gray-100 px-1 py-0.5 rounded">var5</code>
            </p>
          </div>

          {uploadResult ? (
            <div className="bg-green-50 border border-green-200 rounded-xl p-6 text-center space-y-2">
              <CheckCircle className="w-10 h-10 text-green-500 mx-auto" />
              <p className="font-semibold text-green-800">
                {uploadResult.imported} contatos importados
              </p>
              {uploadResult.skipped > 0 && (
                <p className="text-sm text-green-600">{uploadResult.skipped} duplicados ignorados</p>
              )}
            </div>
          ) : (
            <div className={`border-2 border-dashed rounded-xl p-10 text-center transition-colors ${
              uploadFile ? 'border-beacon-primary bg-orange-50' : 'border-gray-200 hover:border-gray-300'
            }`}>
              <input
                type="file"
                accept=".csv,.xls,.xlsx"
                id="contact-upload"
                className="hidden"
                onChange={(e) => {
                  const file = e.target.files?.[0]
                  if (file) { setUploadFile(file); setUploadResult(null) }
                }}
              />
              <label htmlFor="contact-upload" className="cursor-pointer space-y-3 block">
                {uploadFile ? (
                  <>
                    <FileText className="w-10 h-10 text-beacon-primary mx-auto" />
                    <p className="text-sm font-medium text-gray-800">{uploadFile.name}</p>
                    <p className="text-xs text-gray-400">{(uploadFile.size / 1024).toFixed(1)} KB — clique para trocar</p>
                  </>
                ) : (
                  <>
                    <Upload className="w-10 h-10 text-gray-300 mx-auto" />
                    <p className="text-sm font-medium text-gray-600">Clique para selecionar arquivo</p>
                    <p className="text-xs text-gray-400">CSV, XLS ou XLSX — máx. 10 MB</p>
                  </>
                )}
              </label>
            </div>
          )}

          {importMutation.isError && (
            <p className="text-sm text-red-600 flex items-center gap-1.5">
              <AlertCircle className="w-4 h-4" />
              {(importMutation.error as any)?.response?.data?.message ?? 'Erro ao importar arquivo'}
            </p>
          )}

          <div className="flex items-center justify-between">
            <button
              onClick={() => setStep(3)}
              className="text-sm text-gray-400 hover:text-gray-600"
            >
              Pular — importar depois
            </button>

            <div className="flex gap-3">
              {uploadFile && !uploadResult && (
                <button
                  onClick={() => importMutation.mutate(uploadFile)}
                  disabled={importMutation.isPending}
                  className="flex items-center gap-2 px-5 py-2.5 bg-beacon-primary text-white rounded-lg
                             text-sm font-medium hover:bg-beacon-hover disabled:opacity-50 transition-colors"
                >
                  {importMutation.isPending && <Loader2 className="w-4 h-4 animate-spin" />}
                  Importar
                </button>
              )}
              {uploadResult && (
                <button
                  onClick={handleImportSuccess}
                  className="flex items-center gap-2 px-5 py-2.5 bg-beacon-primary text-white rounded-lg
                             text-sm font-medium hover:bg-beacon-hover transition-colors"
                >
                  Continuar
                  <ArrowRight className="w-4 h-4" />
                </button>
              )}
            </div>
          </div>
        </div>
      )}

      {/* ─── Passo 3: Confirmação ─── */}
      {step === 3 && (
        <div className="bg-white border border-gray-200 rounded-xl p-8 shadow-sm text-center space-y-5">
          <CheckCircle className="w-16 h-16 text-green-500 mx-auto" />
          <div>
            <h2 className="font-bold text-gray-900 text-xl">Campanha criada!</h2>
            <p className="text-sm text-gray-500 mt-1">
              {uploadResult
                ? `${uploadResult.imported} contatos importados. Configure a mensagem e lance quando quiser.`
                : 'Você pode importar contatos e lançar a campanha na página de detalhes.'}
            </p>
          </div>
          <button
            onClick={() => navigate(`/campaigns/${createdId}`)}
            className="inline-flex items-center gap-2 px-6 py-3 bg-beacon-primary text-white rounded-lg
                       text-sm font-medium hover:bg-beacon-hover transition-colors"
          >
            Ver campanha
            <ArrowRight className="w-4 h-4" />
          </button>
        </div>
      )}
    </div>
  )
}
