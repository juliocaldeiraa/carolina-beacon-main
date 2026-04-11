/**
 * LeadsTab — Gestão completa de leads (lead_many_insta)
 *
 * Regra absoluta: nunca deletar dados.
 * Recursos: listagem paginada, filtros, listas/páginas, import CSV, export CSV,
 * campos customizados, painel de edição + conversa.
 */

import { useState, useRef, useCallback } from 'react'
import {
  Search, Download, Upload, ChevronLeft, ChevronRight,
  MessageSquare, X, CheckCircle, XCircle, User, Plus,
  Trash2, Settings, Layers, AlertTriangle, Loader2,
} from 'lucide-react'
import {
  useLeads, useLeadFilters, useLeadConversation,
  useLeadFieldDefs, useCreateFieldDef, useDeleteFieldDef,
  useImportLeads, usePatchLead,
} from './hooks/useLeads'
import type { Lead, LeadFieldDef, LeadImportRow } from '@/services/leads'
import { leadsService } from '@/services/leads'
import { Modal }  from '@/components/ui/Modal'
import { Button } from '@/components/ui/Button'
import { cn } from '@/lib/utils'

// ─── Helpers ──────────────────────────────────────────────────────────────────

function fmt(raw?: string | null) {
  if (!raw) return '—'
  try { return new Date(raw).toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit', year: 'numeric' }) }
  catch { return raw }
}

function buildCSV(leads: Lead[], fieldDefs: LeadFieldDef[]): string {
  const fixedHeaders = ['Nome', 'WhatsApp', 'Status', 'Lista', 'Campanha', 'Origem', 'Data Captura', 'Tentativas', 'Converteu']
  const customHeaders = fieldDefs.map((f) => f.label)
  const headers = [...fixedHeaders, ...customHeaders]

  const rows = leads.map((l) => {
    const meta = (l.metadata ?? {}) as Record<string, unknown>
    const fixed = [
      l.nome ?? '', l.whatsapp ?? '', l.status ?? '', l.lista ?? '',
      l.campanha ?? '', l.origem ?? '', fmt(l.dataCaptura ?? l.dataCapturaRaw),
      String(l.tentativas ?? l.tentativasFollowup ?? 0),
      l.converteu ? 'Sim' : 'Não',
    ]
    const custom = fieldDefs.map((f) => String(meta[f.key] ?? ''))
    return [...fixed, ...custom]
  })

  return [headers, ...rows]
    .map((r) => r.map((v) => `"${String(v).replace(/"/g, '""')}"`).join(','))
    .join('\n')
}

function downloadCSV(csv: string, filename: string) {
  const blob = new Blob(['\uFEFF' + csv], { type: 'text/csv;charset=utf-8;' })
  const url  = URL.createObjectURL(blob)
  const a    = Object.assign(document.createElement('a'), { href: url, download: filename })
  a.click()
  URL.revokeObjectURL(url)
}

function parseCSV(text: string): { headers: string[]; rows: string[][] } {
  const lines = text.trim().split(/\r?\n/)
  if (lines.length < 2) return { headers: [], rows: [] }
  const parse = (line: string): string[] => {
    const result: string[] = []
    let cur = '', inQ = false
    for (let i = 0; i < line.length; i++) {
      const ch = line[i]
      if (ch === '"') { if (inQ && line[i + 1] === '"') { cur += '"'; i++ } else inQ = !inQ }
      else if (ch === ',' && !inQ) { result.push(cur.trim()); cur = '' }
      else cur += ch
    }
    result.push(cur.trim())
    return result
  }
  return { headers: parse(lines[0]), rows: lines.slice(1).map(parse) }
}

// ─── Field Defs Manager ───────────────────────────────────────────────────────

function FieldDefsPanel({ onClose }: { onClose: () => void }) {
  const { data: defs = [], isLoading } = useLeadFieldDefs()
  const { mutate: create, isPending: creating } = useCreateFieldDef()
  const { mutate: remove } = useDeleteFieldDef()
  const [newKey, setNewKey]     = useState('')
  const [newLabel, setNewLabel] = useState('')
  const [newType, setNewType]   = useState('text')

  function handleCreate() {
    const key = newKey.trim().replace(/\s+/g, '_').toLowerCase()
    if (!key || !newLabel.trim()) return
    create({ key, label: newLabel.trim(), fieldType: newType }, {
      onSuccess: () => { setNewKey(''); setNewLabel('') },
    })
  }

  const inp = 'text-sm text-white/85 bg-beacon-surface border border-[rgba(255,255,255,0.08)] rounded-lg px-3 py-2 focus:outline-none focus:border-[#00b4d8]/60'

  return (
    <div className="space-y-4">
      {/* Existing fields */}
      {isLoading ? (
        <div className="text-xs text-white/40">Carregando…</div>
      ) : defs.length === 0 ? (
        <div className="text-xs text-white/40 py-4 text-center">Nenhum campo customizado ainda</div>
      ) : (
        <div className="space-y-1.5">
          {defs.map((d) => (
            <div key={d.id} className="flex items-center justify-between px-3 py-2 bg-white/4 rounded-lg border border-[rgba(255,255,255,0.07)]">
              <div>
                <span className="text-xs font-semibold text-white/80">{d.label}</span>
                <span className="ml-2 text-[10px] text-white/35 font-mono">{`{${d.key}}`}</span>
                <span className="ml-2 text-[10px] text-white/30">{d.fieldType}</span>
              </div>
              <button onClick={() => remove(d.id)} className="p-1 text-red-400 hover:bg-red-500/10 rounded transition-colors">
                <Trash2 className="w-3.5 h-3.5" />
              </button>
            </div>
          ))}
        </div>
      )}

      {/* Add new */}
      <div className="border-t border-[rgba(255,255,255,0.07)] pt-4 space-y-3">
        <p className="text-xs font-semibold text-white/50">Novo campo</p>
        <div className="grid grid-cols-2 gap-2">
          <input className={inp} placeholder="Label (ex: Cidade)" value={newLabel} onChange={(e) => setNewLabel(e.target.value)} />
          <input className={inp} placeholder="Chave (ex: cidade)" value={newKey} onChange={(e) => setNewKey(e.target.value)} />
        </div>
        <div className="flex gap-2">
          <select className={inp} value={newType} onChange={(e) => setNewType(e.target.value)}>
            <option value="text">Texto</option>
            <option value="number">Número</option>
            <option value="date">Data</option>
            <option value="boolean">Sim/Não</option>
          </select>
          <Button variant="primary" size="sm" onClick={handleCreate} loading={creating} disabled={!newKey.trim() || !newLabel.trim()}>
            <Plus className="w-3.5 h-3.5" /> Criar
          </Button>
        </div>
      </div>

      <div className="flex justify-end pt-2">
        <Button variant="secondary" size="sm" onClick={onClose}>Fechar</Button>
      </div>
    </div>
  )
}

// ─── Import CSV Modal ─────────────────────────────────────────────────────────

const KNOWN_FIELDS: Record<string, string> = {
  nome: 'nome', name: 'nome', 'nome completo': 'nome',
  whatsapp: 'whatsapp', telefone: 'whatsapp', phone: 'whatsapp', celular: 'whatsapp',
  status: 'status', campanha: 'campanha', campaign: 'campanha',
  origem: 'origem', origin: 'origem', source: 'origem',
  lista: 'lista', list: 'lista', página: 'lista', pagina: 'lista',
}

function ImportModal({ onClose }: { onClose: () => void }) {
  const { mutate: importLeads, isPending } = useImportLeads()
  const [parsed, setParsed]     = useState<{ headers: string[]; rows: string[][] } | null>(null)
  const [mapping, setMapping]   = useState<Record<string, string>>({})
  const [lista, setLista]       = useState('')
  const [result, setResult]     = useState<{ imported: number; updated: number } | null>(null)
  const [error, setError]       = useState('')
  const fileRef = useRef<HTMLInputElement>(null)

  function handleFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file) return
    setError('')
    const reader = new FileReader()
    reader.onload = (ev) => {
      try {
        const p = parseCSV(ev.target?.result as string)
        if (p.headers.length === 0) { setError('CSV inválido ou vazio'); return }
        // Auto-detect mapping
        const m: Record<string, string> = {}
        for (const h of p.headers) {
          const norm = h.toLowerCase().trim()
          m[h] = KNOWN_FIELDS[norm] ?? ''
        }
        setParsed(p)
        setMapping(m)
      } catch { setError('Erro ao ler arquivo') }
    }
    reader.readAsText(file, 'utf-8')
  }

  function handleImport() {
    if (!parsed) return
    const rows: LeadImportRow[] = []
    for (const row of parsed.rows) {
      const obj: LeadImportRow = { nome: '', whatsapp: '' }
      for (const [col, field] of Object.entries(mapping)) {
        const idx = parsed.headers.indexOf(col)
        const val = row[idx]?.trim()
        if (!field || !val) continue
        if (['nome', 'whatsapp', 'status', 'campanha', 'origem', 'lista'].includes(field)) {
          (obj as any)[field] = val
        } else {
          obj[field] = val // campo custom → metadata via backend
        }
      }
      if (obj.nome && obj.whatsapp) rows.push(obj)
    }
    if (rows.length === 0) { setError('Nenhuma linha válida (nome + whatsapp obrigatórios)'); return }
    importLeads({ rows, lista: lista.trim() || undefined }, {
      onSuccess: (res) => setResult(res),
      onError:   () => setError('Erro ao importar — tente novamente'),
    })
  }

  const inp = 'text-sm text-white/85 bg-beacon-surface border border-[rgba(255,255,255,0.08)] rounded-lg px-3 py-2 focus:outline-none focus:border-[#00b4d8]/60'
  const SYSTEM_FIELDS = ['nome', 'whatsapp', 'status', 'campanha', 'origem', 'lista']

  if (result) {
    return (
      <div className="text-center space-y-4 py-4">
        <CheckCircle className="w-12 h-12 text-green-400 mx-auto" />
        <div>
          <p className="text-white font-semibold">{result.imported} leads importados</p>
          <p className="text-white/50 text-sm">{result.updated} atualizados</p>
        </div>
        <Button variant="primary" onClick={onClose}>Fechar</Button>
      </div>
    )
  }

  return (
    <div className="space-y-4">
      {!parsed ? (
        <>
          <div
            onClick={() => fileRef.current?.click()}
            className="border-2 border-dashed border-[rgba(255,255,255,0.12)] rounded-xl p-8 text-center cursor-pointer hover:border-[#00b4d8]/40 transition-colors"
          >
            <Upload className="w-8 h-8 text-white/25 mx-auto mb-3" />
            <p className="text-sm text-white/60">Clique para selecionar um arquivo CSV</p>
            <p className="text-xs text-white/30 mt-1">Colunas sugeridas: nome, whatsapp, status, campanha, origem, lista</p>
          </div>
          <input ref={fileRef} type="file" accept=".csv,text/csv" className="hidden" onChange={handleFile} />
          {error && <p className="text-xs text-red-400">{error}</p>}
        </>
      ) : (
        <>
          <p className="text-xs text-white/50">{parsed.rows.length} linhas detectadas • Mapeie as colunas abaixo</p>

          {/* Column mapping */}
          <div className="space-y-2 max-h-52 overflow-y-auto pr-1">
            {parsed.headers.map((h) => (
              <div key={h} className="flex items-center gap-3">
                <span className="text-xs text-white/60 w-32 truncate shrink-0 font-mono">{h}</span>
                <span className="text-white/30 text-xs">→</span>
                <select
                  value={mapping[h] ?? ''}
                  onChange={(e) => setMapping((m) => ({ ...m, [h]: e.target.value }))}
                  className={cn(inp, 'flex-1 py-1.5')}
                >
                  <option value="">(ignorar)</option>
                  {SYSTEM_FIELDS.map((f) => <option key={f} value={f}>{f}</option>)}
                  <option value={h.toLowerCase().replace(/\s+/g, '_')}>campo custom: {h}</option>
                </select>
              </div>
            ))}
          </div>

          {/* Preview */}
          <div className="rounded-lg bg-white/4 border border-[rgba(255,255,255,0.06)] overflow-x-auto">
            <table className="text-[11px] text-white/60 w-full">
              <thead>
                <tr className="border-b border-[rgba(255,255,255,0.06)]">
                  {parsed.headers.map((h) => <th key={h} className="px-2 py-1.5 text-left font-medium text-white/40">{h}</th>)}
                </tr>
              </thead>
              <tbody>
                {parsed.rows.slice(0, 3).map((r, i) => (
                  <tr key={i} className="border-b border-[rgba(255,255,255,0.04)]">
                    {r.map((v, j) => <td key={j} className="px-2 py-1.5 max-w-[120px] truncate">{v}</td>)}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* Lista */}
          <div>
            <label className="text-xs text-white/50 block mb-1">Atribuir à lista (opcional)</label>
            <input className={inp} placeholder="ex: Lista VIP, Campanha Janeiro…" value={lista} onChange={(e) => setLista(e.target.value)} />
          </div>

          {error && <p className="text-xs text-red-400 flex items-center gap-1"><AlertTriangle className="w-3 h-3" />{error}</p>}

          <div className="flex gap-3 justify-end pt-2">
            <Button variant="secondary" onClick={() => { setParsed(null); setError('') }}>Voltar</Button>
            <Button variant="primary" onClick={handleImport} loading={isPending}>
              Importar {parsed.rows.length} leads
            </Button>
          </div>
        </>
      )}
    </div>
  )
}

// ─── Lead Detail Panel ────────────────────────────────────────────────────────

function LeadPanel({ lead, fieldDefs, onClose }: {
  lead: Lead
  fieldDefs: LeadFieldDef[]
  onClose: () => void
}) {
  const phone = lead.whatsapp ?? null
  const { data, isLoading } = useLeadConversation(phone)
  const { mutate: patch } = usePatchLead()
  const lines = data?.turns ?? []

  const [tab, setTab] = useState<'info' | 'conversa'>('conversa')
  const [editMeta, setEditMeta]   = useState<Record<string, string>>(
    Object.fromEntries(fieldDefs.map((f) => [f.key, String((lead.metadata as any)?.[f.key] ?? '')]))
  )
  const [editStatus, setEditStatus] = useState(lead.status ?? '')
  const [editLista,  setEditLista]  = useState(lead.lista  ?? '')
  const [editNotas,  setEditNotas]  = useState(lead.notas  ?? '')
  const [saving, setSaving] = useState(false)

  async function handleSave() {
    setSaving(true)
    const metadata: Record<string, unknown> = {}
    for (const [k, v] of Object.entries(editMeta)) if (v.trim()) metadata[k] = v.trim()
    await patch({ id: lead.id, data: {
      status:   editStatus || undefined,
      lista:    editLista  || undefined,
      notas:    editNotas  || undefined,
      metadata: Object.keys(metadata).length > 0 ? metadata : undefined,
    }})
    setSaving(false)
  }

  const inp = 'text-sm text-white/85 bg-beacon-surface border border-[rgba(255,255,255,0.08)] rounded-lg px-3 py-2 focus:outline-none focus:border-[#00b4d8]/60 w-full'

  return (
    <aside className="w-96 shrink-0 border-l border-[rgba(255,255,255,0.07)] bg-beacon-surface flex flex-col">
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-3 border-b border-[rgba(255,255,255,0.07)]">
        <div>
          <p className="text-sm font-semibold text-white">{lead.nome ?? lead.whatsapp ?? 'Lead'}</p>
          <p className="text-xs text-white/40">{lead.whatsapp}</p>
        </div>
        <button onClick={onClose} className="p-1.5 rounded-lg text-white/40 hover:bg-white/8 hover:text-white transition-colors">
          <X className="w-4 h-4" />
        </button>
      </div>

      {/* Badges */}
      <div className="px-4 py-2 flex flex-wrap gap-1.5 border-b border-[rgba(255,255,255,0.07)]">
        {lead.status   && <span className="text-[10px] px-2 py-0.5 rounded-full bg-white/8 text-white/60">{lead.status}</span>}
        {lead.campanha && <span className="text-[10px] px-2 py-0.5 rounded-full bg-blue-500/20 text-blue-300">{lead.campanha}</span>}
        {lead.lista    && <span className="text-[10px] px-2 py-0.5 rounded-full bg-purple-500/20 text-purple-300">{lead.lista}</span>}
        <span className={cn('text-[10px] px-2 py-0.5 rounded-full flex items-center gap-1',
          lead.converteu ? 'bg-green-500/20 text-green-400' : 'bg-white/8 text-white/40')}>
          {lead.converteu ? <CheckCircle className="w-3 h-3" /> : <XCircle className="w-3 h-3" />}
          {lead.converteu ? 'Convertido' : 'Não convertido'}
        </span>
      </div>

      {/* Tabs */}
      <div className="flex border-b border-[rgba(255,255,255,0.07)]">
        {(['conversa', 'info'] as const).map((t) => (
          <button key={t} onClick={() => setTab(t)} className={cn(
            'flex-1 py-2 text-xs font-medium transition-colors',
            tab === t ? 'text-[#00b4d8] border-b-2 border-[#00b4d8]' : 'text-white/40 hover:text-white/70',
          )}>
            {t === 'conversa' ? 'Conversa' : 'Editar'}
          </button>
        ))}
      </div>

      {tab === 'conversa' ? (
        <div className="flex-1 overflow-y-auto px-4 py-4 space-y-3">
          {isLoading ? (
            <div className="flex items-center justify-center h-full"><Loader2 className="w-5 h-5 animate-spin text-white/30" /></div>
          ) : lines.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-full gap-3 text-center">
              <MessageSquare className="w-8 h-8 text-white/25" />
              <p className="text-xs text-white/40">Sem histórico de conversa</p>
            </div>
          ) : lines.map((line, i) => {
            const isUser = line.role === 'user'
            return (
              <div key={i} className={cn('flex', isUser ? 'justify-end' : 'justify-start')}>
                <div className={cn('max-w-[85%] rounded-2xl px-3 py-2 text-xs',
                  isUser ? 'bg-beacon-primary text-white rounded-br-sm' : 'bg-beacon-surface-2 text-white/85 rounded-bl-sm')}>
                  <p className="leading-relaxed whitespace-pre-wrap break-words">{line.content}</p>
                </div>
              </div>
            )
          })}
        </div>
      ) : (
        <div className="flex-1 overflow-y-auto px-4 py-4 space-y-3">
          <div>
            <label className="text-xs text-white/50 block mb-1">Status</label>
            <input className={inp} value={editStatus} onChange={(e) => setEditStatus(e.target.value)} placeholder="ex: em_conversa" />
          </div>
          <div>
            <label className="text-xs text-white/50 block mb-1">Lista / Página</label>
            <input className={inp} value={editLista} onChange={(e) => setEditLista(e.target.value)} placeholder="ex: Lista VIP" />
          </div>
          <div>
            <label className="text-xs text-white/50 block mb-1">Notas</label>
            <textarea className={cn(inp, 'resize-none')} rows={2} value={editNotas} onChange={(e) => setEditNotas(e.target.value)} />
          </div>
          {fieldDefs.length > 0 && (
            <>
              <p className="text-xs font-semibold text-white/30 pt-2">Campos customizados</p>
              {fieldDefs.map((f) => (
                <div key={f.key}>
                  <label className="text-xs text-white/50 block mb-1">{f.label}</label>
                  <input className={inp} value={editMeta[f.key] ?? ''} onChange={(e) => setEditMeta((m) => ({ ...m, [f.key]: e.target.value }))} />
                </div>
              ))}
            </>
          )}
          <Button variant="primary" size="sm" className="w-full mt-2" onClick={handleSave} loading={saving}>
            Salvar alterações
          </Button>
        </div>
      )}
    </aside>
  )
}

// ─── Main ──────────────────────────────────────────────────────────────────────

const PAGE_SIZE = 50

export function LeadsTab() {
  const [page, setPage]             = useState(1)
  const [search, setSearch]         = useState('')
  const [statusFilter, setStatus]   = useState('')
  const [campFilter, setCamp]       = useState('')
  const [listaFilter, setLista]     = useState('')
  const [selected, setSelected]     = useState<Lead | null>(null)
  const [showImport, setShowImport] = useState(false)
  const [showFields, setShowFields] = useState(false)
  const [exporting, setExporting]   = useState(false)

  const { data, isLoading }    = useLeads({ page, limit: PAGE_SIZE, search: search || undefined, status: statusFilter || undefined, campanha: campFilter || undefined, lista: listaFilter || undefined })
  const { data: filterOpts }   = useLeadFilters()
  const { data: fieldDefs = [] } = useLeadFieldDefs()

  const leads      = data?.data      ?? []
  const total      = data?.total     ?? 0
  const totalPages = data?.totalPages ?? 1

  const handleExport = useCallback(async () => {
    setExporting(true)
    try {
      const all = await leadsService.exportAll({ search: search || undefined, status: statusFilter || undefined, campanha: campFilter || undefined, lista: listaFilter || undefined })
      downloadCSV(buildCSV(all, fieldDefs), `leads_${new Date().toISOString().slice(0, 10)}.csv`)
    } finally { setExporting(false) }
  }, [search, statusFilter, campFilter, listaFilter, fieldDefs])

  const selClass = 'text-sm border border-[rgba(255,255,255,0.08)] rounded-lg px-3 py-2 bg-beacon-surface focus:outline-none focus:border-[#00b4d8]/60 text-white/85'

  return (
    <div className="flex h-full min-h-0">
      <div className="flex flex-col flex-1 min-w-0 gap-4">

        {/* Toolbar row 1: search + lista */}
        <div className="flex flex-wrap gap-2">
          <div className="relative flex-1 min-w-[200px]">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-white/35" />
            <input type="search" placeholder="Buscar nome ou WhatsApp…" value={search}
              onChange={(e) => { setSearch(e.target.value); setPage(1) }}
              className="w-full pl-9 pr-3 py-2 text-sm bg-beacon-surface border border-[rgba(255,255,255,0.08)] rounded-lg focus:outline-none focus:border-[#00b4d8]/60 placeholder:text-white/25 text-white/85"
            />
          </div>

          {/* Lista/Páginas */}
          <div className="flex items-center gap-1.5">
            <Layers className="w-4 h-4 text-purple-400 shrink-0" />
            <select value={listaFilter} onChange={(e) => { setLista(e.target.value); setPage(1) }} className={selClass}>
              <option value="">Todas as listas</option>
              {(filterOpts?.listas ?? []).map((l) => <option key={l} value={l}>{l}</option>)}
            </select>
          </div>

          <select value={statusFilter} onChange={(e) => { setStatus(e.target.value); setPage(1) }} className={selClass}>
            <option value="">Todos os status</option>
            {(filterOpts?.statuses ?? []).map((s) => <option key={s} value={s}>{s}</option>)}
          </select>

          <select value={campFilter} onChange={(e) => { setCamp(e.target.value); setPage(1) }} className={selClass}>
            <option value="">Todas as campanhas</option>
            {(filterOpts?.campanhas ?? []).map((c) => <option key={c} value={c}>{c}</option>)}
          </select>
        </div>

        {/* Toolbar row 2: actions */}
        <div className="flex items-center justify-between gap-2 flex-wrap">
          <p className="text-xs text-white/40">
            {isLoading ? 'Carregando…' : `${total.toLocaleString('pt-BR')} lead${total !== 1 ? 's' : ''}`}
            {listaFilter && <span className="ml-2 text-purple-400">• {listaFilter}</span>}
          </p>
          <div className="flex gap-2">
            <button onClick={() => setShowFields(true)}
              className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-white/60 bg-beacon-surface border border-[rgba(255,255,255,0.08)] rounded-lg hover:bg-white/8 transition-colors">
              <Settings className="w-3.5 h-3.5" /> Campos
            </button>
            <button onClick={() => setShowImport(true)}
              className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-[#00b4d8] bg-[#00b4d8]/10 border border-[#00b4d8]/20 rounded-lg hover:bg-[#00b4d8]/20 transition-colors">
              <Upload className="w-3.5 h-3.5" /> Importar CSV
            </button>
            <button onClick={handleExport} disabled={total === 0 || exporting}
              className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-white/60 bg-beacon-surface border border-[rgba(255,255,255,0.08)] rounded-lg hover:bg-white/8 transition-colors disabled:opacity-40">
              {exporting ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Download className="w-3.5 h-3.5" />}
              Exportar CSV
            </button>
          </div>
        </div>

        {/* Table */}
        <div className="overflow-x-auto rounded-xl border border-[rgba(255,255,255,0.07)] bg-beacon-surface">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-[rgba(255,255,255,0.07)] bg-white/4">
                <th className="text-left px-4 py-3 text-xs font-semibold text-white/40 whitespace-nowrap"><User className="inline w-3.5 h-3.5 mr-1" />Nome</th>
                <th className="text-left px-4 py-3 text-xs font-semibold text-white/40 whitespace-nowrap">WhatsApp</th>
                <th className="text-left px-4 py-3 text-xs font-semibold text-white/40 whitespace-nowrap">Status</th>
                <th className="text-left px-4 py-3 text-xs font-semibold text-white/40 whitespace-nowrap">Lista</th>
                <th className="text-left px-4 py-3 text-xs font-semibold text-white/40 whitespace-nowrap">Campanha</th>
                <th className="text-left px-4 py-3 text-xs font-semibold text-white/40 whitespace-nowrap">Captura</th>
                <th className="text-center px-4 py-3 text-xs font-semibold text-white/40">Tent.</th>
                <th className="text-center px-4 py-3 text-xs font-semibold text-white/40">Conv.</th>
                {fieldDefs.map((f) => (
                  <th key={f.key} className="text-left px-4 py-3 text-xs font-semibold text-purple-400/60 whitespace-nowrap">{f.label}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {isLoading ? (
                Array.from({ length: 8 }).map((_, i) => (
                  <tr key={i} className="border-b border-[rgba(255,255,255,0.06)]">
                    {Array.from({ length: 8 + fieldDefs.length }).map((_, j) => (
                      <td key={j} className="px-4 py-3"><div className="h-3 bg-white/8 rounded animate-pulse" /></td>
                    ))}
                  </tr>
                ))
              ) : leads.length === 0 ? (
                <tr><td colSpan={8 + fieldDefs.length} className="px-4 py-16 text-center text-sm text-white/40">Nenhum lead encontrado</td></tr>
              ) : leads.map((lead) => {
                const meta = (lead.metadata ?? {}) as Record<string, unknown>
                return (
                  <tr key={lead.id} onClick={() => setSelected(selected?.id === lead.id ? null : lead)}
                    className={cn('border-b border-beacon-gray/40 cursor-pointer transition-colors',
                      selected?.id === lead.id ? 'bg-beacon-primary/10' : 'hover:bg-white/5')}>
                    <td className="px-4 py-3 font-medium text-white truncate max-w-[140px]">{lead.nome ?? <span className="text-white/35">—</span>}</td>
                    <td className="px-4 py-3 text-white/50 whitespace-nowrap">{lead.whatsapp ?? '—'}</td>
                    <td className="px-4 py-3">
                      {lead.status ? <span className="text-[10px] font-medium px-2 py-0.5 rounded-full bg-white/8 text-white/60">{lead.status}</span> : <span className="text-white/30">—</span>}
                    </td>
                    <td className="px-4 py-3">
                      {lead.lista ? <span className="text-[10px] font-medium px-2 py-0.5 rounded-full bg-purple-500/20 text-purple-300">{lead.lista}</span> : <span className="text-white/30">—</span>}
                    </td>
                    <td className="px-4 py-3 text-white/50 truncate max-w-[120px]">{lead.campanha ?? <span className="text-white/30">—</span>}</td>
                    <td className="px-4 py-3 text-white/50 whitespace-nowrap">{fmt(lead.dataCaptura ?? lead.dataCapturaRaw)}</td>
                    <td className="px-4 py-3 text-center text-white/50">{lead.tentativas ?? lead.tentativasFollowup ?? 0}</td>
                    <td className="px-4 py-3 text-center">
                      {lead.converteu ? <CheckCircle className="w-4 h-4 text-green-500 mx-auto" /> : <XCircle className="w-4 h-4 text-white/25 mx-auto" />}
                    </td>
                    {fieldDefs.map((f) => (
                      <td key={f.key} className="px-4 py-3 text-white/50 truncate max-w-[120px]">
                        {String(meta[f.key] ?? '') || <span className="text-white/20">—</span>}
                      </td>
                    ))}
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>

        {/* Pagination */}
        {totalPages > 1 && (
          <div className="flex items-center justify-between">
            <p className="text-xs text-white/40">Página {page} de {totalPages}</p>
            <div className="flex gap-1">
              <button onClick={() => setPage((p) => Math.max(1, p - 1))} disabled={page === 1}
                className="p-1.5 rounded-lg border border-[rgba(255,255,255,0.08)] text-white/50 hover:bg-white/8 disabled:opacity-40 transition-colors">
                <ChevronLeft className="w-4 h-4" />
              </button>
              <button onClick={() => setPage((p) => Math.min(totalPages, p + 1))} disabled={page === totalPages}
                className="p-1.5 rounded-lg border border-[rgba(255,255,255,0.08)] text-white/50 hover:bg-white/8 disabled:opacity-40 transition-colors">
                <ChevronRight className="w-4 h-4" />
              </button>
            </div>
          </div>
        )}
      </div>

      {/* Side panel */}
      {selected && <LeadPanel lead={selected} fieldDefs={fieldDefs} onClose={() => setSelected(null)} />}

      {/* Import Modal */}
      <Modal open={showImport} onClose={() => setShowImport(false)} title="Importar CSV" description="Importe leads para a tabela lead_many_insta. Leads existentes (mesmo WhatsApp) serão atualizados, não duplicados." size="lg">
        <ImportModal onClose={() => setShowImport(false)} />
      </Modal>

      {/* Field Defs Modal */}
      <Modal open={showFields} onClose={() => setShowFields(false)} title="Campos Customizados" description="Gerencie campos extras que aparecem na tabela e nos templates de mensagem.">
        <FieldDefsPanel onClose={() => setShowFields(false)} />
      </Modal>
    </div>
  )
}
