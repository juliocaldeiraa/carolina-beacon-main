/**
 * SpintextEditor — Editor de variações com múltiplas partes por variação
 *
 * Estrutura: variations[varIdx][partIdx]
 * - varIdx  = qual variação (A/B/C) — uma é sorteada por lead
 * - partIdx = partes sequenciais enviadas uma após a outra (mensagens quebradas)
 */

import { useRef } from 'react'
import { Plus, Trash2 } from 'lucide-react'

interface Props {
  variations:     string[][]          // [variação A, variação B, ...] cada variação = [parte1, parte2, ...]
  onChange:       (v: string[][]) => void
  activeIdx:      number
  onActiveChange: (idx: number) => void
  label?:         string
  maxVariations?: number
}

const VAR_BUTTONS = ['{{1}}', '{{2}}', '{{3}}', '{{4}}', '{{5}}']

export function SpintextEditor({
  variations,
  onChange,
  activeIdx,
  onActiveChange,
  label = 'Variações de mensagem',
  maxVariations = 5,
}: Props) {
  const textareaRefs = useRef<(HTMLTextAreaElement | null)[]>([])

  const activeParts = variations[activeIdx] ?? ['']

  const updatePart = (partIdx: number, text: string) => {
    const next = variations.map((parts, vi) =>
      vi === activeIdx
        ? parts.map((p, pi) => (pi === partIdx ? text : p))
        : parts,
    )
    onChange(next)
  }

  const addPart = () => {
    const next = variations.map((parts, vi) =>
      vi === activeIdx ? [...parts, ''] : parts,
    )
    onChange(next)
  }

  const removePart = (partIdx: number) => {
    if (activeParts.length <= 1) return
    const next = variations.map((parts, vi) =>
      vi === activeIdx ? parts.filter((_, pi) => pi !== partIdx) : parts,
    )
    onChange(next)
  }

  const addVariation = () => {
    if (variations.length >= maxVariations) return
    onChange([...variations, ['']])
    onActiveChange(variations.length)
  }

  const removeVariation = (idx: number) => {
    if (variations.length <= 1) return
    const next = variations.filter((_, i) => i !== idx)
    onChange(next)
    onActiveChange(Math.min(activeIdx, next.length - 1))
  }

  const insertVar = (partIdx: number, token: string) => {
    const ta = textareaRefs.current[partIdx]
    if (!ta) return
    const start = ta.selectionStart
    const end   = ta.selectionEnd
    const next  = activeParts[partIdx].slice(0, start) + token + activeParts[partIdx].slice(end)
    updatePart(partIdx, next)
    requestAnimationFrame(() => {
      ta.selectionStart = start + token.length
      ta.selectionEnd   = start + token.length
      ta.focus()
    })
  }

  const totalChars = activeParts.reduce((sum, p) => sum + p.length, 0)

  return (
    <div className="space-y-3">
      <label className="text-sm font-medium text-gray-700">{label}</label>

      {/* Tabs de variação */}
      <div className="flex items-center gap-1 flex-wrap">
        {variations.map((parts, idx) => {
          const chars = parts.reduce((s, p) => s + p.length, 0)
          return (
            <div key={idx} className="relative group">
              <button
                type="button"
                onClick={() => onActiveChange(idx)}
                className={`px-3 py-1.5 text-xs rounded-lg font-medium transition-colors ${
                  idx === activeIdx
                    ? 'bg-beacon-primary text-white'
                    : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                }`}
              >
                Variação {idx + 1}
                {chars > 0 && (
                  <span className="ml-1 opacity-60">({chars}c)</span>
                )}
              </button>
              {variations.length > 1 && (
                <button
                  type="button"
                  onClick={(e) => { e.stopPropagation(); removeVariation(idx) }}
                  className="absolute -top-1 -right-1 w-4 h-4 bg-red-500 text-white rounded-full
                             hidden group-hover:flex items-center justify-center text-[10px] leading-none"
                >
                  ×
                </button>
              )}
            </div>
          )
        })}
        {variations.length < maxVariations && (
          <button
            type="button"
            onClick={addVariation}
            className="px-2 py-1.5 text-xs rounded-lg border border-dashed border-gray-300
                       text-gray-500 hover:border-beacon-primary hover:text-beacon-primary flex items-center gap-1"
          >
            <Plus className="w-3 h-3" />
            Add
          </button>
        )}
      </div>

      {/* Partes da variação ativa */}
      <div className="space-y-2">
        {activeParts.map((part, partIdx) => (
          <div key={partIdx} className="relative group/part">
            {activeParts.length > 1 && (
              <div className="flex items-center gap-1.5 mb-1">
                <span className="text-[10px] font-semibold text-gray-400 uppercase tracking-wide">
                  Mensagem {partIdx + 1}
                </span>
                {partIdx > 0 && (
                  <span className="text-[10px] text-gray-300">• enviada em sequência</span>
                )}
              </div>
            )}
            <div className="relative">
              <textarea
                ref={(el) => { textareaRefs.current[partIdx] = el }}
                value={part}
                onChange={(e) => updatePart(partIdx, e.target.value)}
                rows={4}
                placeholder={
                  partIdx === 0
                    ? 'Digite sua mensagem... Use {{1}} para o nome, {{2}} para variáveis extras.'
                    : 'Continuação enviada logo após a mensagem anterior...'
                }
                className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm resize-y
                           focus:outline-none focus:ring-2 focus:ring-beacon-primary font-mono pr-8"
              />
              {activeParts.length > 1 && (
                <button
                  type="button"
                  onClick={() => removePart(partIdx)}
                  className="absolute top-2 right-2 p-1 text-gray-300 hover:text-red-500 transition-colors"
                  title="Remover esta parte"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                </button>
              )}
            </div>

            {/* Botões de variável por parte */}
            <div className="flex items-center gap-1.5 flex-wrap mt-1">
              <span className="text-xs text-gray-400">Inserir:</span>
              {VAR_BUTTONS.map((v) => (
                <button
                  key={v}
                  type="button"
                  onClick={() => insertVar(partIdx, v)}
                  className="px-2 py-0.5 text-xs font-mono bg-orange-50 border border-orange-200
                             text-orange-700 rounded hover:bg-orange-100 transition-colors"
                >
                  {v}
                </button>
              ))}
            </div>
          </div>
        ))}

        {/* Botão para adicionar parte */}
        <button
          type="button"
          onClick={addPart}
          className="w-full py-2 border border-dashed border-gray-200 rounded-lg text-xs text-gray-400
                     hover:border-beacon-primary hover:text-beacon-primary flex items-center justify-center gap-1.5
                     transition-colors"
        >
          <Plus className="w-3.5 h-3.5" />
          Adicionar mensagem (enviada em sequência)
        </button>
      </div>

      {/* Contagem total */}
      <p className="text-xs text-gray-400 text-right">
        {totalChars} caracteres · {activeParts.length} {activeParts.length === 1 ? 'mensagem' : 'mensagens'}
      </p>
    </div>
  )
}
