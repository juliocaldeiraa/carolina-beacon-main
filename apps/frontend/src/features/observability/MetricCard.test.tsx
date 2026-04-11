import { render, screen } from '@testing-library/react'
import { describe, it, expect } from 'vitest'
import { Zap, DollarSign } from 'lucide-react'
import { KpiCard, MetricCard } from './MetricCard'

describe('KpiCard', () => {
  it('renderiza título e valor', () => {
    render(<KpiCard title="Latência" value="342ms" icon={Zap} />)
    expect(screen.getByText('Latência')).toBeInTheDocument()
    expect(screen.getByText('342ms')).toBeInTheDocument()
  })

  it('renderiza description quando fornecida', () => {
    render(<KpiCard title="Custo" value="$0.02" icon={DollarSign} description="por conversa" />)
    expect(screen.getByText('por conversa')).toBeInTheDocument()
  })

  it('não renderiza description quando ausente', () => {
    const { container } = render(<KpiCard title="Métrica" value="100" icon={Zap} />)
    // apenas title, value e ícone — sem parágrafo extra
    const paragraphs = container.querySelectorAll('p')
    expect(paragraphs).toHaveLength(1) // só o valor
  })
})

describe('MetricCard', () => {
  it('renderiza skeleton quando loading=true', () => {
    const { container } = render(
      <MetricCard title="Métrica" value="—" icon={Zap} loading />,
    )
    expect(container.querySelector('.animate-pulse')).toBeInTheDocument()
    expect(screen.queryByText('—')).not.toBeInTheDocument()
  })

  it('renderiza valor quando loading=false', () => {
    render(<MetricCard title="Taxa de Sucesso" value="98.5%" icon={Zap} />)
    expect(screen.getByText('98.5%')).toBeInTheDocument()
    expect(screen.getByText('Taxa de Sucesso')).toBeInTheDocument()
  })

  it('renderiza trendLabel quando fornecido', () => {
    render(<MetricCard title="Conversas" value="1.234" icon={Zap} trendLabel="15/dia em média" />)
    expect(screen.getByText('15/dia em média')).toBeInTheDocument()
  })
})
