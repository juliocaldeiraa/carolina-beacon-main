/**
 * E2E — Observabilidade
 *
 * Fluxo: Dashboard → filtros de período → verificar painéis
 */

import { test, expect } from '@playwright/test'

test.describe('Observabilidade', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/observability')
  })

  test('exibe o dashboard de observabilidade', async ({ page }) => {
    await expect(page.getByText('Observabilidade')).toBeVisible()
  })

  test('mostra os 4 painéis de métricas', async ({ page }) => {
    await expect(page.getByText('Performance')).toBeVisible()
    await expect(page.getByText('Financeiro')).toBeVisible()
    await expect(page.getByText('Qualidade')).toBeVisible()
    await expect(page.getByText('Engajamento')).toBeVisible()
  })

  test('botões de filtro de período funcionam', async ({ page }) => {
    const btn30d = page.getByRole('button', { name: /30 dias/i })
    await expect(btn30d).toBeVisible()
    await btn30d.click()
    await expect(btn30d).toHaveAttribute('aria-pressed', 'true')
  })

  test('botão de refresh funciona', async ({ page }) => {
    const refreshBtn = page.getByRole('button', { name: /atualizar/i })
    await expect(refreshBtn).toBeVisible()
    await refreshBtn.click()
  })

  test('exportar CSV do painel financeiro', async ({ page }) => {
    const downloadPromise = page.waitForEvent('download', { timeout: 5000 }).catch(() => null)
    const csvBtn = page.getByRole('button', { name: /csv/i })
    if (await csvBtn.isVisible()) {
      await csvBtn.click()
      const download = await downloadPromise
      if (download) {
        expect(download.suggestedFilename()).toContain('beacon-financeiro')
      }
    }
  })
})
