import { useState, useEffect, useCallback } from 'react'
import { playgroundService }                from '@/services/playground'
import type { ChatMessage, MessageMetadata } from '@/types/playground'

interface ContextMessage {
  role: 'user' | 'assistant'
  content: string
}

// Delay simulando "digitando..." entre mensagens fatiadas
function typingDelay(index: number): Promise<void> {
  const base  = index === 0 ? 500 : 700
  const extra = Math.floor(Math.random() * 400)
  return new Promise((resolve) => setTimeout(resolve, base + extra))
}

export function usePlayground(
  agentId:         string | null,
  model?:          string | null,
  contextMessages?: ContextMessage[],
) {
  const [sessionId, setSessionId] = useState<string | null>(null)
  const [messages,  setMessages]  = useState<ChatMessage[]>([])
  const [lastMeta,  setLastMeta]  = useState<MessageMetadata | null>(null)
  const [loading,   setLoading]   = useState(false)
  const [error,     setError]     = useState<string | null>(null)

  const resetSession = useCallback(async () => {
    if (!agentId) return
    const { sessionId: sid } = await playgroundService.createSession(contextMessages)
    setSessionId(sid)

    // Exibe mensagens de contexto como bubbles visuais (sem enviá-las à IA)
    const visualContext: ChatMessage[] = (contextMessages ?? []).map((m) => ({
      role:      m.role,
      content:   m.content,
      timestamp: new Date().toISOString(),
      isContext: true,
    }))
    setMessages(visualContext)
    setLastMeta(null)
    setError(null)
  }, [agentId, JSON.stringify(contextMessages)]) // eslint-disable-line react-hooks/exhaustive-deps

  // Cria nova sessão quando agente ou contexto muda
  useEffect(() => {
    if (agentId) resetSession()
  }, [agentId, resetSession])

  const sendMessage = useCallback(async (message: string) => {
    if (!sessionId || !agentId || loading) return
    setLoading(true)
    setError(null)

    setMessages((prev) => [
      ...prev,
      { role: 'user', content: message, timestamp: new Date().toISOString() },
    ])

    try {
      const res = await playgroundService.chat(agentId, sessionId, message, model ?? undefined)

      for (let i = 0; i < res.messages.length; i++) {
        await typingDelay(i)
        setMessages((prev) => [
          ...prev,
          {
            role:      'assistant',
            content:   res.messages[i],
            timestamp: new Date().toISOString(),
            ...(i === res.messages.length - 1 && { metadata: res.metadata }),
          },
        ])
      }

      setLastMeta(res.metadata)
    } catch {
      setError('Erro ao enviar mensagem. Verifique se o agente está ativo.')
      setMessages((prev) => prev.slice(0, -1))
    } finally {
      setLoading(false)
    }
  }, [agentId, sessionId, loading, model])

  return { messages, lastMeta, loading, error, sendMessage, resetSession }
}
