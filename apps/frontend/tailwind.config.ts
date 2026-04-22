import type { Config } from 'tailwindcss'

const config: Config = {
  content: ['./index.html', './src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      colors: {
        beacon: {
          primary:         '#10B981',
          'primary-hover': '#059669',
          'primary-light': '#D1FAE5',
          secondary:       '#34D399',
          accent:          '#22C55E',
          destructive:     '#DC2626',
          app:             'rgb(var(--c-app) / <alpha-value>)',
          surface:         'rgb(var(--c-surface) / <alpha-value>)',
          'surface-2':     'rgb(var(--c-surface-2) / <alpha-value>)',
        },
      },
      fontFamily: {
        heading: ['Figtree', 'system-ui', 'sans-serif'],
        sans:    ['Noto Sans', 'system-ui', 'sans-serif'],
      },
      boxShadow: {
        card:         '0 1px 3px rgba(0,0,0,0.06), 0 1px 2px rgba(0,0,0,0.04)',
        'card-hover': '0 4px 12px rgba(0,0,0,0.08)',
        fab:          '0 4px 12px rgba(16,185,129,0.25)',
        sm:           '0 1px 2px rgba(0,0,0,0.05)',
      },
      borderRadius: {
        card: '12px',
      },
    },
  },
  plugins: [],
}

export default config
