import { render, screen } from '@testing-library/react'
import userEvent           from '@testing-library/user-event'
import { describe, it, expect, vi } from 'vitest'
import { Button } from './Button'

describe('Button', () => {
  it('renderiza os children', () => {
    render(<Button>Clique aqui</Button>)
    expect(screen.getByRole('button', { name: 'Clique aqui' })).toBeInTheDocument()
  })

  it('chama onClick ao ser clicado', async () => {
    const onClick = vi.fn()
    render(<Button onClick={onClick}>Ação</Button>)
    await userEvent.click(screen.getByRole('button'))
    expect(onClick).toHaveBeenCalledOnce()
  })

  it('fica desabilitado quando disabled=true', () => {
    render(<Button disabled>Ação</Button>)
    expect(screen.getByRole('button')).toBeDisabled()
  })

  it('não chama onClick quando desabilitado', async () => {
    const onClick = vi.fn()
    render(<Button disabled onClick={onClick}>Ação</Button>)
    await userEvent.click(screen.getByRole('button'), { pointerEventsCheck: 0 })
    expect(onClick).not.toHaveBeenCalled()
  })

  it('mostra spinner e fica desabilitado quando loading=true', () => {
    const { container } = render(<Button loading>Carregando</Button>)
    expect(screen.getByRole('button')).toBeDisabled()
    expect(container.querySelector('.animate-spin')).toBeInTheDocument()
  })

  it('aplica variant secondary corretamente', () => {
    render(<Button variant="secondary">Secundário</Button>)
    const btn = screen.getByRole('button')
    expect(btn).toHaveClass('bg-beacon-gray')
  })

  it('aplica size lg corretamente', () => {
    render(<Button size="lg">Grande</Button>)
    expect(screen.getByRole('button')).toHaveClass('px-6')
  })
})
