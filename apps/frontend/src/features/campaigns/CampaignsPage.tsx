/**
 * CampaignsPage — Lista de campanhas de disparo
 */

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { useNavigate } from 'react-router-dom'
import {
  Plus, Play, Pause, RotateCcw, Trash2, Loader2,
  CheckCircle, AlertCircle, Clock, FileText, ChevronRight, Copy,
} from 'lucide-react'
import { campaignsApi, type Campaign } from '@/services/campaigns-api'

const STATUS_CONFIG: Record<Campaign['status'], {
  label: string; icon: React.ElementType; className: string
}> = {
  DRAFT:     { label: 'Rascunho',   icon: FileText,     className: 'bg-gray-100 text-gray-600'   },
  RUNNING:   { label: 'Executando', icon: Play,         className: 'bg-green-100 text-green-700' },
  PAUSED:    { label: 'Pausada',    icon: Pause,        className: 'bg-yellow-100 text-yellow-700'},
  COMPLETED: { label: 'Concluída',  icon: CheckCircle,  className: 'bg-blue-100 text-blue-700'  },
  FAILED:    { label: 'Falhou',     icon: AlertCircle,  className: 'bg-red-100 text-red-700'    },
}

export function CampaignsPage() {
  const navigate = useNavigate()
  const qc       = useQueryClient()

  const { data: campaigns = [], isLoading } = useQuery({
    queryKey: ['campaigns'],
    queryFn:  campaignsApi.list,
    refetchInterval: 5_000, // refresh durante execução
  })

  const launchMutation = useMutation({
    mutationFn: campaignsApi.launch,
    onSuccess:  () => qc.invalidateQueries({ queryKey: ['campaigns'] }),
  })
  const pauseMutation = useMutation({
    mutationFn: campaignsApi.pause,
    onSuccess:  () => qc.invalidateQueries({ queryKey: ['campaigns'] }),
  })
  const resumeMutation = useMutation({
    mutationFn: campaignsApi.resume,
    onSuccess:  () => qc.invalidateQueries({ queryKey: ['campaigns'] }),
  })
  const removeMutation = useMutation({
    mutationFn: campaignsApi.remove,
    onSuccess:  () => qc.invalidateQueries({ queryKey: ['campaigns'] }),
  })
  const duplicateMutation = useMutation({
    mutationFn: campaignsApi.duplicate,
    onSuccess:  (data) => {
      qc.invalidateQueries({ queryKey: ['campaigns'] })
      navigate(`/campaigns/${data.id}`)
    },
  })

  return (
    <div className="max-w-5xl mx-auto space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Campanhas</h1>
          <p className="text-sm text-gray-500 mt-1">
            Crie e gerencie campanhas de disparo em massa
          </p>
        </div>
        <button
          onClick={() => navigate('/campaigns/new')}
          className="flex items-center gap-2 px-4 py-2 bg-beacon-primary text-white rounded-lg
                     hover:bg-beacon-hover text-sm font-medium transition-colors"
        >
          <Plus className="w-4 h-4" />
          Nova campanha
        </button>
      </div>

      {/* List */}
      {isLoading ? (
        <div className="flex items-center justify-center py-20">
          <Loader2 className="w-6 h-6 animate-spin text-beacon-primary" />
        </div>
      ) : campaigns.length === 0 ? (
        <div className="text-center py-20 text-gray-400 space-y-3">
          <FileText className="w-12 h-12 mx-auto opacity-30" />
          <p className="text-sm">Nenhuma campanha criada ainda.</p>
          <button
            onClick={() => navigate('/campaigns/new')}
            className="text-sm text-beacon-primary hover:underline"
          >
            Criar primeira campanha
          </button>
        </div>
      ) : (
        <div className="space-y-3">
          {campaigns.map((c) => {
            const cfg   = STATUS_CONFIG[c.status]
            const Icon  = cfg.icon
            const total = c._count?.leads ?? c.totalLeads
            const pct   = total > 0 ? Math.round((c.sentCount / total) * 100) : 0

            return (
              <div
                key={c.id}
                className="bg-white border border-gray-200 rounded-xl p-5 shadow-sm"
              >
                <div className="flex items-start gap-4">
                  {/* Status icon */}
                  <div className={`mt-0.5 p-2 rounded-lg ${cfg.className}`}>
                    <Icon className="w-4 h-4" />
                  </div>

                  {/* Main info */}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-1">
                      <span className="font-semibold text-gray-900">{c.name}</span>
                      <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${cfg.className}`}>
                        {cfg.label}
                      </span>
                    </div>

                    {/* Stats */}
                    <div className="flex items-center gap-4 text-xs text-gray-500 mb-3">
                      <span>{total} leads</span>
                      <span>{c.sentCount} enviados</span>
                      {c.errorCount > 0 && <span className="text-red-500">{c.errorCount} erros</span>}
                      <span className="flex items-center gap-1">
                        <Clock className="w-3 h-3" />
                        {c.delayMinSec}–{c.delayMaxSec}s entre envios
                      </span>
                    </div>

                    {/* Progress bar */}
                    {(c.status === 'RUNNING' || c.status === 'COMPLETED' || c.status === 'PAUSED') && total > 0 && (
                      <div className="space-y-1">
                        <div className="w-full bg-gray-100 rounded-full h-1.5">
                          <div
                            className="bg-beacon-primary h-1.5 rounded-full transition-all"
                            style={{ width: `${pct}%` }}
                          />
                        </div>
                        <span className="text-xs text-gray-400">{pct}% concluído</span>
                      </div>
                    )}
                  </div>

                  {/* Actions */}
                  <div className="flex items-center gap-1.5 shrink-0">
                    {c.status === 'DRAFT' && (
                      <button
                        onClick={() => launchMutation.mutate(c.id)}
                        disabled={launchMutation.isPending}
                        className="flex items-center gap-1 px-3 py-1.5 bg-green-600 text-white
                                   rounded-lg text-xs font-medium hover:bg-green-700 disabled:opacity-50"
                      >
                        <Play className="w-3 h-3" />
                        Lançar
                      </button>
                    )}
                    {c.status === 'RUNNING' && (
                      <button
                        onClick={() => pauseMutation.mutate(c.id)}
                        className="flex items-center gap-1 px-3 py-1.5 bg-yellow-500 text-white
                                   rounded-lg text-xs font-medium hover:bg-yellow-600"
                      >
                        <Pause className="w-3 h-3" />
                        Pausar
                      </button>
                    )}
                    {c.status === 'PAUSED' && (
                      <button
                        onClick={() => resumeMutation.mutate(c.id)}
                        className="flex items-center gap-1 px-3 py-1.5 bg-green-600 text-white
                                   rounded-lg text-xs font-medium hover:bg-green-700"
                      >
                        <RotateCcw className="w-3 h-3" />
                        Retomar
                      </button>
                    )}

                    {/* Duplicate */}
                    <button
                      onClick={() => duplicateMutation.mutate(c.id)}
                      disabled={duplicateMutation.isPending}
                      title="Duplicar campanha"
                      className="p-1.5 text-gray-400 hover:text-blue-600 hover:bg-blue-50 rounded-lg"
                    >
                      {duplicateMutation.isPending
                        ? <Loader2 className="w-4 h-4 animate-spin" />
                        : <Copy className="w-4 h-4" />
                      }
                    </button>

                    {/* Detail */}
                    <button
                      onClick={() => navigate(`/campaigns/${c.id}`)}
                      className="p-1.5 text-gray-400 hover:text-beacon-primary hover:bg-orange-50 rounded-lg"
                    >
                      <ChevronRight className="w-4 h-4" />
                    </button>

                    {/* Delete */}
                    {(c.status === 'DRAFT' || c.status === 'COMPLETED' || c.status === 'FAILED') && (
                      <button
                        onClick={() => { if (confirm('Excluir campanha?')) removeMutation.mutate(c.id) }}
                        className="p-1.5 text-gray-400 hover:text-red-500 hover:bg-red-50 rounded-lg"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    )}
                  </div>
                </div>
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}
