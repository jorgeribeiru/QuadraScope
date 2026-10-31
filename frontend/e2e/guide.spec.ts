import { test, expect } from '@playwright/test'
import AxeBuilder from '@axe-core/playwright'

test('guia apresenta enunciado, limites e mapa mesmo com a API indisponível', async ({ page }) => {
  const requests: string[] = []
  await page.route('**/api/v1/**', (route) => {
    requests.push(route.request().url())
    return route.abort()
  })
  await page.goto('/guia')
  await expect(page.getByRole('heading', { level: 1, name: 'Guia do projeto' })).toBeVisible()
  await expect(page.locator('.requirement-card')).toHaveCount(24)
  await expect(page.locator('#R14')).toContainText(
    'As demais colunas numéricas ficaram fora dessa etapa',
  )
  await expect(page.locator('#R06')).toContainText(
    'código-fonte e o endereço da aplicação no Classroom',
  )
  await expect(page.locator('main')).toContainText(
    'analisamos os jogos de Atlanta Hawks e Houston Rockets',
  )
  await expect(page.locator('main')).not.toContainText('certificação de cumprimento')
  await page
    .getByRole('navigation', { name: 'Seções de Guia do projeto' })
    .getByRole('link', { name: /Mapa do site/ })
    .click()
  await expect(page.locator('#mapa h2')).toBeFocused()
  expect(requests).toEqual([])
  const audit = await new AxeBuilder({ page }).withTags(['wcag2a', 'wcag2aa', 'wcag21aa']).analyze()
  expect(audit.violations).toEqual([])
})

test('consulta pronta seleciona Houston e BLK, leva à seção e preserva o destino na recarga', async ({
  page,
}) => {
  await page.goto('/guia#consultas')
  await page.getByRole('link', { name: /Distribuição de tocos de Houston/ }).click()
  await expect(page).toHaveURL(/\/times\/1610612745#variavel=BLK&secao=distribuicao$/)
  await expect(page.getByLabel('Variável do perfil')).toHaveValue('BLK')
  await expect(page.locator('#distribuicao h2')).toBeFocused()
  await expect(page.locator('#medidas table').first()).toContainText('5,82')
  await page.reload()
  await expect(page.locator('#distribuicao h2')).toBeFocused()
  await page
    .locator('.team-switch')
    .getByRole('link', { name: 'Atlanta Hawks', exact: true })
    .click()
  await expect(page).toHaveURL(/\/times\/1610612737#variavel=BLK&secao=distribuicao$/)
  await expect(page.locator('#distribuicao h2')).toBeFocused()
  await page.goBack()
  await expect(page).toHaveURL(/\/times\/1610612745#variavel=BLK&secao=distribuicao$/)
})

test('busca funciona por teclado, por assunto e sem resultados, com retorno do foco', async ({
  page,
}) => {
  await page.goto('/guia')
  const trigger = page.getByRole('button', { name: 'Buscar no relatório', exact: true })
  await trigger.click()
  const dialog = page.getByRole('dialog')
  const input = dialog.getByRole('searchbox')
  await expect(input).toBeFocused()
  await input.fill('assuntoinexistente')
  await expect(dialog.getByRole('status')).toHaveText('0 resultados encontrados.')
  await page.keyboard.press('Escape')
  await expect(trigger).toBeFocused()
  await page.keyboard.press('Control+k')
  await input.fill('Little')
  await dialog.getByRole('link', { name: /Dados e métodos.*Ausências/ }).click()
  await expect(page).toHaveURL(/\/dados#ausencias$/)
  await expect(page.locator('#ausencias h2')).toBeFocused()
  await page.getByRole('button', { name: 'Buscar no relatório', exact: true }).click()
  await input.fill('tocos')
  await expect(dialog.getByRole('link', { name: /Houston · Tocos/ })).toBeVisible()
  const audit = await new AxeBuilder({ page }).withTags(['wcag2a', 'wcag2aa', 'wcag21aa']).analyze()
  expect(audit.violations).toEqual([])
})

test('consultas de tabelas filtram a exibição e preservam a identidade dos dados', async ({
  page,
}) => {
  const before = await (await page.request.get('/api/v1/health')).json()
  await page.goto('/dados#dicionario')
  const table = page.getByRole('table', { name: /^Dicionário completo/ })
  await expect(table.getByRole('row')).toHaveCount(29)
  await page.getByLabel('Buscar no dicionário').fill('tocos')
  await expect(table.getByRole('row')).toHaveCount(2)
  await expect(table).toContainText('BLK')
  await page.getByLabel('Tipo de dado').selectOption('date')
  await expect(table).toContainText('Nenhuma linha corresponde')
  await page.locator('#dicionario').getByRole('button', { name: 'Limpar consulta' }).click()
  await expect(table.getByRole('row')).toHaveCount(29)
  await expect(table).toContainText('REB=OREB+DREB')
  const after = await (await page.request.get('/api/v1/health')).json()
  expect(after).toEqual(before)
})

test('barras usam as cinco medidas da API e compartilham medida e filtros na URL', async ({
  page,
}) => {
  await page.goto('/comparar?metric=BLK&venue=home')
  const response = await (
    await page.request.get('/api/v1/comparisons?metric=BLK&venue=home')
  ).json()
  for (const measure of ['mean', 'median', 'std', 'cv', 'iqr']) {
    await page.getByLabel('Medida das barras').selectOption(measure)
    const table = page.getByRole('table', { name: /^Dados das barras:/ })
    for (const row of response.selected_summary) {
      const value = row.statistics[measure].value.toLocaleString('pt-BR', {
        minimumFractionDigits: 2,
        maximumFractionDigits: 2,
      })
      await expect(table).toContainText(value)
      await expect(table).toContainText(row.statistics[measure].unit)
    }
  }
  await page.getByRole('combobox', { name: 'Mando', exact: true }).selectOption('away')
  await page.getByRole('button', { name: 'Aplicar', exact: true }).click()
  await expect(page.getByLabel('Medida das barras')).toHaveValue('iqr')
  await expect(page).toHaveURL(/venue=away.*#medida=iqr$/)
  await page.reload()
  await expect(page.getByLabel('Medida das barras')).toHaveValue('iqr')
  await page.goto('/comparar#zscore')
  await expect(page.locator('#zscore')).toHaveAttribute('open', '')
})

test('guia, busca e índices são utilizáveis em tela pequena', async ({ page }, testInfo) => {
  await page.setViewportSize({ width: 390, height: 844 })
  await page.goto('/guia')
  await page
    .getByRole('navigation', { name: 'Seções de Guia do projeto' })
    .getByRole('link', { name: /Consultas prontas/ })
    .click()
  await expect(page.locator('#consultas h2')).toBeFocused()
  await page.screenshot({ path: testInfo.outputPath('guia-mobile.png') })
  await page.getByRole('button', { name: 'Buscar no relatório', exact: true }).click()
  await expect(page.getByRole('dialog')).toBeVisible()
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true)
  await page.keyboard.press('Escape')
  await page.getByRole('button', { name: 'Alternar navegação' }).click()
  await page
    .getByRole('navigation', { name: 'Navegação principal' })
    .getByRole('link', { name: 'Dados e métodos' })
    .click()
  await expect(
    page.getByRole('heading', { name: 'Conheça os dados antes de interpretar' }),
  ).toBeVisible()
})
