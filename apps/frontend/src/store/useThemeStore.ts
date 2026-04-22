/**
 * useThemeStore — Gerenciamento de tema dark/light
 * Persiste em localStorage (voxai-theme) e aplica class .dark no <html>.
 * Default = light.
 */

import { create } from 'zustand'

export type Theme = 'dark' | 'light'

interface ThemeState {
  theme: Theme
  toggle: () => void
  setTheme: (t: Theme) => void
}

const STORAGE_KEY = 'voxai-theme'

function applyTheme(theme: Theme) {
  const html = document.documentElement
  if (theme === 'dark') html.classList.add('dark')
  else                  html.classList.remove('dark')
  try { localStorage.setItem(STORAGE_KEY, theme) } catch {}
}

function getInitialTheme(): Theme {
  try {
    const saved = localStorage.getItem(STORAGE_KEY) as Theme | null
    if (saved === 'dark' || saved === 'light') return saved
  } catch {}
  return 'light'
}

export const useThemeStore = create<ThemeState>((set) => ({
  theme: getInitialTheme(),

  toggle: () =>
    set((state) => {
      const next: Theme = state.theme === 'dark' ? 'light' : 'dark'
      applyTheme(next)
      return { theme: next }
    }),

  setTheme: (t) => {
    applyTheme(t)
    set({ theme: t })
  },
}))
