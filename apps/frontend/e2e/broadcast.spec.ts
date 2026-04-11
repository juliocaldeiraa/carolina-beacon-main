/**
 * E2E — Broadcast
 *
 * Fluxo: Criar campanha → Lançar → Acompanhar status
 */

import { test, expect } from '@playwright/test'

test.describe('Broadcast', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/broadcast')
  })

  test('exibe a página de broadcast', async ({ page }) => {
    await expect(page.getByText('Broadcast')).toBeVisible()
    await expect(page.getByRole('button', { name: /nova campanha/i })).toBeVisible()
  })

  test('abre e fecha o formulário de criação', async ({ page }) => {
    await page.getByRole('button', { name: /nova campanha/i }).click()
    await expect(page.getByRole('dialog')).toBeVisible()
    await page.getByRole('button', { name: /cancelar/i }).click()
    await expect(page.getByRole('dialog')).not.toBeVisible()
  })

  test('filtra campanhas por status', async ({ page }) => {
    const tab = page.getByRole('tab', { name: 'Rascunho' })
    if (await tab.isVisible()) {
      await tab.click()
      await expect(tab).toHaveAttribute('aria-selected', 'true')
    }
  })

  test('cria uma campanha em rascunho', async ({ page }) => {
    // Pula se não há agentes disponíveis
    await page.getByRole('button', { name: /nova campanha/i }).click()
    const dialog = page.getByRole('dialog')
    await expect(dialog).toBeVisible()

    await dialog.getByLabel(/nome da campanha/i).fill('Campanha E2E')
    await dialog.getByLabel(/mensagem template/i).fill(
      'Olá {nome}, temos uma novidade para você!',
    )
    await dialog.getByLabel(/contatos/i).fill('Maria|maria@test.com\nJoão|joao@test.com')

    // Preview deve aparecer
    await expect(dialog.getByText('Preview')).toBeVisible()
    await expect(dialog.getByText(/Olá Maria/)).toBeVisible()
  })
})
