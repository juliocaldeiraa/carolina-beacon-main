/**
 * ThemeToggle — Alterna entre dark e light mode
 * Ícone: Lua (dark) / Sol (light)
 */

import { Sun, Moon } from 'lucide-react'
import { useThemeStore } from '@/store/useThemeStore'
import { cn } from '@/lib/utils'

export function ThemeToggle({ className }: { className?: string }) {
  const { theme, toggle } = useThemeStore()
  const isDark = theme === 'dark'

  return (
    <button
      onClick={toggle}
      className={cn(
        'relative p-2 rounded-lg transition-all duration-300',
        isDark
          ? 'text-white/50 hover:bg-white/8 hover:text-white'
          : 'text-white/50 hover:bg-white/8 hover:text-white',
        className,
      )}
      aria-label={isDark ? 'Mudar para tema claro' : 'Mudar para tema escuro'}
      title={isDark ? 'Tema claro' : 'Tema escuro'}
    >
      <span
        className={cn(
          'absolute inset-0 flex items-center justify-center transition-all duration-300',
          isDark ? 'opacity-100 rotate-0' : 'opacity-0 rotate-90',
        )}
      >
        <Moon className="w-5 h-5" />
      </span>
      <span
        className={cn(
          'flex items-center justify-center transition-all duration-300',
          isDark ? 'opacity-0 -rotate-90' : 'opacity-100 rotate-0',
        )}
      >
        <Sun className="w-5 h-5" />
      </span>
    </button>
  )
}
