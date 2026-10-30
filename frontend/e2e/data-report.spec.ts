import { test, expect } from '@playwright/test'

test('índice orienta para as seções e permite voltar por teclado', async ({ page }) => {
  await page.goto('/dados')
  const index = page.getByRole('navigation', { name: 'Seções de Dados e métodos' })
  await expect(page.getByText('DOCUMENTAÇÃO DA BASE COMPLETA')).toBeVisible()
  await expect(index.getByRole('link')).toHaveCount(6)
  const dictionary = index.getByRole('link', { name: /Dicionário/ })
  await dictionary.focus()
  await page.keyboard.press('Enter')
  await expect(page).toHaveURL(/#dicionario$/)
  await expect(page.getByRole('heading', { name: 'Dicionário dos dados' })).toBeVisible()
  const back = page
    .locator('#dicionario')
    .getByRole('link', { name: 'Voltar ao índice de Dados e métodos' })
  await back.focus()
  await page.keyboard.press('Enter')
  await expect(page).toHaveURL(/#indice-dados$/)
})

test('Dados apresenta dimensões, todas as colunas e auditoria com escopos distintos', async ({
  page,
}) => {
  await page.goto('/dados?venue=home')
  await expect(page).toHaveURL(/\/dados$/)
  await expect(page.getByRole('region', { name: 'Filtros da análise' })).toHaveCount(0)
  const coverage = page.getByRole('table', {
    name: 'Cobertura dos históricos de Atlanta e Houston no CSV completo.',
  })
  await expect(coverage).toContainText('Atlanta Hawks')
  await expect(coverage).toContainText('Houston Rockets')
  const atlanta = coverage.getByRole('row').filter({ hasText: 'Atlanta Hawks' })
  await expect(atlanta.getByRole('cell').nth(1)).toHaveText('75')
  await expect(atlanta.getByRole('cell').nth(8)).toHaveText('2')
  const houston = coverage.getByRole('row').filter({ hasText: 'Houston Rockets' })
  await expect(houston.getByRole('cell').nth(1)).toHaveText('74')
  await expect(houston.getByRole('cell').nth(8)).toHaveText('8')
  const dictionary = page.getByRole('table', { name: /Dicionário completo:/ })
  await expect(dictionary.getByRole('row')).toHaveCount(29)
  await expect(dictionary).toContainText('cumulative_wins')
  await expect(dictionary).toContainText('Booleano')
  const quality = page.getByRole('table', {
    name: 'Qualidade por coluna — base completa, 28 colunas originais.',
  })
  await expect(quality.getByRole('row')).toHaveCount(29)
  const blocks = quality
    .getByRole('row')
    .filter({ has: page.getByRole('cell', { name: 'BLK', exact: true }) })
  await expect(blocks.getByRole('cell').nth(2)).toHaveText('2238')
  await expect(blocks.getByRole('cell').nth(4)).toHaveText('33')
  await page.getByText('Auditoria por coluna no recorte Atlanta/Houston', { exact: true }).click()
  const focus = page.getByRole('table', {
    name: 'Qualidade por coluna — somente as observações dos dois times em foco.',
  })
  const focusBlocks = focus
    .getByRole('row')
    .filter({ has: page.getByRole('cell', { name: 'BLK', exact: true }) })
  await expect(focusBlocks.getByRole('cell').nth(2)).toHaveText('149')
  await expect(focusBlocks.getByRole('cell').nth(4)).toHaveText('0')
  const methods = page.locator('.method-card')
  await expect(methods).toHaveCount(4)
  for (const method of await methods.all()) {
    await expect(method).toContainText('Não aplicável neste recorte')
    await expect(method).toContainText('não executado')
    await expect(method).toContainText('não calculados')
  }
  await expect(
    page.getByRole('heading', { name: 'Métodos, stack e limites da análise' }),
  ).toBeVisible()
  await expect(page.locator('#origem')).toContainText('Não informada')
  await page.screenshot({ path: 'test-results/data-report-desktop.png', fullPage: true })
})

test('falha na auditoria não vira qualidade aprovada nem oculta o dicionário', async ({ page }) => {
  await page.route('**/api/v1/quality', (route) =>
    route.fulfill({
      status: 503,
      contentType: 'application/json',
      body: JSON.stringify({
        error: { code: 'artifacts_unavailable', message: 'Auditoria indisponível.', details: [] },
      }),
    }),
  )
  await page.setViewportSize({ width: 390, height: 844 })
  await page.goto('/dados')
  await expect(page.getByRole('table', { name: /Dicionário completo:/ })).toBeVisible()
  await expect(page.getByRole('alert').first()).toContainText('temporariamente indisponíveis')
  const qualityLink = page
    .getByRole('navigation', { name: 'Seções de Dados e métodos' })
    .getByRole('link', { name: /Qualidade/ })
  await expect(qualityLink).toHaveAttribute('href', '#auditoria')
  await qualityLink.click()
  await expect(page).toHaveURL(/#auditoria$/)
  await expect(
    page.getByRole('heading', { name: 'Auditoria de qualidade', exact: true }),
  ).toHaveCount(0)
  await expect(
    page.getByRole('heading', { name: 'Ausências: mecanismos e aplicabilidade dos testes' }),
  ).toHaveCount(0)
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true)
})
