import type { Config } from 'tailwindcss'

// Cores derivadas de: /Brand/Brand Playbook - Guia de Uso de Cores da Plataforma Beacon.md
const config: Config = {
  content: ['./index.html', './src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      colors: {
        beacon: {
          primary:         '#f06529',   // Laranja Principal — ações primárias, CTAs
          'primary-hover': '#e34c26',   // Laranja Secundário — hover/active/focus
          gray:            '#ebebeb',   // Cinza Claro — backward compat
          white:           '#ffffff',   // Branco — backward compat
          black:           '#000000',   // Preto — backward compat
          // Dark UI tokens — via CSS vars para suporte a temas
          app:             'rgb(var(--c-app) / <alpha-value>)',
          surface:         'rgb(var(--c-surface) / <alpha-value>)',
          'surface-2':     'rgb(var(--c-surface-2) / <alpha-value>)',
        },
      },
      fontFamily: {
        sans: ['Inter', 'system-ui', 'sans-serif'],
      },
      boxShadow: {
        card:          '0 1px 3px rgba(0,0,0,0.1)',
        'card-hover':  '0 4px 12px rgba(0,0,0,0.15)',
        fab:           '0 4px 12px rgba(240,101,41,0.4)',
        // Dark UI glow shadows
        glow:          '0 0 24px rgba(240,101,41,0.30)',
        'glow-sm':     '0 0 12px rgba(240,101,41,0.15)',
        'glow-cyan':   '0 0 24px rgba(0,180,216,0.25)',
        surface:       '0 4px 24px rgba(0,0,0,0.50)',
      },
      borderRadius: {
        card: '8px',
      },
    },
  },
  plugins: [],
}

export default config
