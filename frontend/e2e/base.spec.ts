import { test, expect } from '@playwright/test'
test('consulta real, URL compartilhável e recarga de rota profunda', async ({ page }) => {
  await page.goto('/')
  await expect(page.getByRole('heading', { name: 'Os times em foco' })).toBeVisible()
  await expect(page.getByText('75 jogos', { exact: true })).toBeVisible()
  await expect(page.getByText('74 jogos', { exact: true })).toBeVisible()
  await page.locator('canvas').first().waitFor()
  await page.screenshot({ path: 'test-results/overview-desktop.png', fullPage: true })
  await page.getByRole('combobox', { name: 'Mando', exact: true }).selectOption('home')
  await page.getByRole('button', { name: 'Aplicar', exact: true }).click()
  await expect(page).toHaveURL(/venue=home/)
  await expect(page.getByText('38 jogos', { exact: true })).toBeVisible()
  await expect(page.getByText('35 jogos', { exact: true })).toBeVisible()
  await page.getByRole('link', { name: 'Comparação', exact: true }).click()
  await expect(page).toHaveURL(/comparar\?venue=home/)
  await page.reload()
  await expect(page.getByRole('table')).toContainText('118,11')
  await expect(page.getByRole('table')).toContainText('113,11')
  await page.goBack()
  await expect(page.getByText('38 jogos', { exact: true })).toBeVisible()
})
test('estado vazio é diferente de indisponibilidade da API', async ({ page }) => {
  await page.goto('/comparar?from=2099-01-01')
  await expect(page.getByRole('heading', { name: 'Nenhuma partida nesta seleção' })).toBeVisible()
  await page.route('**/api/v1/meta', (route) =>
    route.fulfill({
      status: 503,
      contentType: 'application/json',
      body: JSON.stringify({
        error: { code: 'artifacts_unavailable', message: 'Dados indisponíveis.', details: [] },
      }),
    }),
  )
  await page.goto('/')
  await expect(page.getByRole('alert')).toContainText('temporariamente indisponíveis')
  await expect(
    page.getByRole('heading', { name: 'Nenhuma partida nesta seleção' }),
  ).not.toBeVisible()
})
test('URL inválida não dispara consultas analíticas', async ({ page }) => {
  const requests: string[] = []
  page.on('request', (request) => {
    if (request.url().includes('/comparisons')) requests.push(request.url())
  })
  await page.goto('/?venue=neutral')
  await expect(page.getByRole('alert')).toContainText('Mando inválido')
  expect(requests).toEqual([])
})
test('navegação móvel, tabela acessível e layout sem transbordamento', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 })
  await page.goto('/')
  await expect(page.getByRole('heading', { name: 'Os times em foco' })).toBeVisible()
  await page.getByRole('button', { name: 'Alternar navegação' }).click()
  await page.getByRole('link', { name: 'Perfil dos times', exact: true }).click()
  await expect(page.getByRole('table')).toBeVisible()
  await expect(page.locator('aside')).not.toBeInViewport()
  await page.screenshot({ path: 'test-results/profile-mobile.png', fullPage: true })
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true)
})

test('filtros ficam apenas na Home e Comparação, sem seleção oculta nos perfis', async ({
  page,
}) => {
  const filteredProfiles: string[] = []
  page.on('request', (request) => {
    const url = new URL(request.url())
    if (/\/teams\/\d+\/summary$/.test(url.pathname) && url.searchParams.get('venue') === 'home')
      filteredProfiles.push(url.href)
  })
  await page.goto('/?venue=home&outcome=win&metric=REB')
  await expect(page.getByRole('region', { name: 'Filtros da análise' })).toBeVisible()
  await page.getByRole('link', { name: 'Comparação', exact: true }).click()
  await expect(page).toHaveURL(/\/comparar\?venue=home&outcome=win&metric=REB$/)
  await expect(page.getByRole('region', { name: 'Filtros da análise' })).toBeVisible()
  await page.getByRole('link', { name: 'Perfil dos times', exact: true }).click()
  await expect(page).toHaveURL(/\/times\/1610612737$/)
  await expect(page.getByRole('region', { name: 'Filtros da análise' })).toHaveCount(0)
  await expect(page.getByText('75 jogos', { exact: true })).toBeVisible()
  await page.getByRole('link', { name: 'Houston Rockets', exact: true }).click()
  await expect(page).toHaveURL(/\/times\/1610612745$/)
  await expect(page.getByText('74 jogos', { exact: true })).toBeVisible()
  expect(filteredProfiles).toEqual([])
  await page.getByRole('link', { name: 'Fora da curva', exact: true }).click()
  await expect(page.getByRole('heading', { name: 'Partidas sob a lente do LOF' })).toBeVisible()
  await expect(page.getByRole('region', { name: 'Filtros da análise' })).toHaveCount(0)
  await page.getByRole('link', { name: 'Dados e métodos', exact: true }).click()
  await expect(page.getByRole('heading', { name: 'Dicionário dos dados' })).toBeVisible()
  await expect(page.getByRole('region', { name: 'Filtros da análise' })).toHaveCount(0)
})

test('URLs antigas dos perfis são normalizadas antes de consultar o histórico completo', async ({
  page,
}) => {
  await page.goto('/times/1610612737?venue=home&outcome=win&metric=REB')
  await expect(page).toHaveURL(/\/times\/1610612737$/)
  await expect(page.getByText('75 jogos', { exact: true })).toBeVisible()
  await expect(page.getByRole('region', { name: 'Filtros da análise' })).toHaveCount(0)
})
