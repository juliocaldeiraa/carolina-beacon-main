/**
 * useNotificationsStore — Histórico persistente de notificações
 *
 * Cada toast disparado na aplicação é também gravado aqui.
 * Persistido em localStorage (beacon-notifications).
 * Máximo de 100 entradas; as mais antigas são descartadas automaticamente.
 */

import { create } from 'zustand'
import { persist } from 'zustand/middleware'
import type { ToastType } from '@/components/ui/Toast'

export interface Notification {
  id:        string
  type:      ToastType
  title:     string
  message?:  string
  createdAt: number  // ms timestamp
  read:      boolean
}

interface NotificationsState {
  notifications: Notification[]
  add:          (opts: { type: ToastType; title: string; message?: string }) => void
  markAllRead:  () => void
  clearAll:     () => void
}

export const useNotificationsStore = create<NotificationsState>()(
  persist(
    (set) => ({
      notifications: [],

      add: ({ type, title, message }) =>
        set((s) => ({
          notifications: [
            {
              id:        Math.random().toString(36).slice(2),
              type,
              title,
              message,
              createdAt: Date.now(),
              read:      false,
            },
            ...s.notifications.slice(0, 99),
          ],
        })),

      markAllRead: () =>
        set((s) => ({
          notifications: s.notifications.map((n) => ({ ...n, read: true })),
        })),

      clearAll: () => set({ notifications: [] }),
    }),
    { name: 'beacon-notifications' },
  ),
)

/** Seletor: quantidade de não lidas */
export const selectUnreadCount = (s: NotificationsState) =>
  s.notifications.filter((n) => !n.read).length
