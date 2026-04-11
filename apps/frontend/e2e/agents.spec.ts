/**
 * E2E — Módulo de Agentes
 *
 * Fluxo: Login → Lista de Agentes → Criar Agente → Ver Detalhes
 * Pré-requisito: app rodando em localhost:5173, backend + DB disponíveis
 */

import { test, expect } from '@playwright/test'

const TEST_USER = {
  email:    'admin@beacon.dev',
  password: 'beacon123',
}

test.describe('Gestão de Agentes', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/')
    // Login se necessário
    if (page.url().includes('/login')) {
      await page.fill('[name="email"]', TEST_USER.email)
      await page.fill('[name="password"]', TEST_USER.password)
      await page.click('[type="submit"]')
      await page.waitForURL('/agents')
    }
  })

  test('exibe a lista de agentes', async ({ page }) => {
    await page.goto('/agents')
    await expect(page.getByRole('main')).toBeVisible()
    // Header da página
    await expect(page.getByText('Gestão de Agentes')).toBeVisible()
  })

  test('abre o formulário de criação ao clicar no FAB', async ({ page }) => {
    await page.goto('/agents')
    // FAB "Criar Novo Agente"
    const fab = page.getByRole('button', { name: /criar novo agente/i })
    await expect(fab).toBeVisible()
    await fab.click()
    await expect(page).toHaveURL('/agents/new')
  })

  test('cria um novo agente via wizard', async ({ page }) => {
    await page.goto('/agents/new')

    // Step 1 — Nome e descrição
    await page.fill('[name="name"]',        'Agente E2E Test')
    await page.fill('[name="description"]', 'Criado por teste E2E')
    await page.getByRole('button', { name: /próximo/i }).click()

    // Step 2 — Modelo (seleciona o primeiro)
    const modelOption = page.locator('[name="model"]').first()
    await modelOption.click()
    await page.getByRole('button', { name: /próximo/i }).click()

    // Step 3 — System Prompt (opcional)
    await page.getByRole('button', { name: /próximo/i }).click()

    // Step 4 — Tools (pula)
    await page.getByRole('button', { name: /próximo/i }).click()

    // Step 5 — Revisão → Publicar
    await expect(page.getByText('Agente E2E Test')).toBeVisible()
    await page.getByRole('button', { name: /publicar agente/i }).click()

    // Redireciona para /agents após publicar
    await page.waitForURL('/agents')
    await expect(page.getByText('Agente E2E Test')).toBeVisible()
  })

  test('filtra agentes por status', async ({ page }) => {
    await page.goto('/agents')
    const filterSelect = page.getByRole('combobox', { name: /status/i })
    if (await filterSelect.isVisible()) {
      await filterSelect.selectOption('PAUSED')
    }
  })

  test('navega para o detalhe do agente', async ({ page }) => {
    await page.goto('/agents')
    const cards = page.locator('[data-testid="agent-card"]')
    if (await cards.count() > 0) {
      await cards.first().click()
      await expect(page.getByText('Detalhes do Agente')).toBeVisible()
    }
  })
})
