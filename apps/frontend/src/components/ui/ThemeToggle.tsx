/**
 * ThemeToggle — alterna entre dark e light mode
 */

import { Sun, Moon } from 'lucide-react'
import { useThemeStore } from '@/store/useThemeStore'
import { cn } from '@/lib/utils'

export function ThemeToggle({ className }: { className?: string }) {
  const { theme, toggle } = useThemeStore()
  const isDark = theme === 'dark'

  return (
    <button
      type="button"
      onClick={toggle}
      className={cn(
        'p-2 rounded-xl text-gray-400 hover:bg-gray-50 hover:text-[#10B981] transition-colors',
        className,
      )}
      aria-label={isDark ? 'Mudar para tema claro' : 'Mudar para tema escuro'}
      title={isDark ? 'Tema claro' : 'Tema escuro'}
    >
      {isDark ? <Sun className="w-5 h-5" /> : <Moon className="w-5 h-5" />}
    </button>
  )
}
