/**
 * useThemeStore — Gerenciamento de tema dark/light
 * Persiste em localStorage e sincroniza com data-theme no <html>
 */

import { create } from 'zustand'

export type Theme = 'dark' | 'light'

interface ThemeState {
  theme: Theme
  toggle: () => void
  setTheme: (t: Theme) => void
}

function applyTheme(theme: Theme) {
  const html = document.documentElement
  if (theme === 'light') {
    html.setAttribute('data-theme', 'light')
  } else {
    html.removeAttribute('data-theme')
  }
  try { localStorage.setItem('beacon-theme', theme) } catch {}
}

function getInitialTheme(): Theme {
  try {
    const saved = localStorage.getItem('beacon-theme') as Theme | null
    if (saved === 'light' || saved === 'dark') return saved
  } catch {}
  return 'dark'
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
