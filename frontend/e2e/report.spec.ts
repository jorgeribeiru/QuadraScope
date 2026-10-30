import { test, expect } from '@playwright/test'
const teams = ['1610612737', '1610612745']
const metrics = ['PTS', 'REB', 'AST', 'STL', 'BLK', 'PF', 'FG3M']
const number = (v: number) =>
  v.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
test('destaques preservam os valores, amostras e escopos dos perfis e da comparação', async ({
  page,
}) => {
  const summary = await (await page.request.get(`/api/v1/teams/${teams[0]}/summary`)).json()
  const points = summary.results.find((row: { metric: string }) => row.metric === 'PTS')
  await page.goto(`/times/${teams[0]}`)
  await expect(page.getByText('HISTÓRICO COMPLETO DO TIME', { exact: true })).toBeVisible()
  await expect(page.locator('.measure-highlights')).toContainText(
    number(points.statistics.mean.value),
  )
  await expect(page.locator('.measure-highlights')).toContainText(
    number(points.statistics.iqr.value),
  )
  await expect(page.getByRole('table', { name: /^Todas as medidas de PTS/ })).toHaveCount(1)
  await page.goto('/comparar?venue=home&metric=REB')
  const cards = page.locator('.comparison-highlights')
  await expect(cards).toContainText('38 jogos')
  await expect(cards).toContainText('35 jogos')
  await expect(cards).toContainText('Rebotes')
  const measures = cards.locator('article').first().locator('.comparison-measures')
  await expect(measures.locator('dt')).toHaveText(['Mediana', 'Desvio padrão amostral'])
  await expect(measures.locator('dd').first()).not.toHaveText('—')
  const sizes = await measures.evaluate((node) => ({
    label: parseFloat(getComputedStyle(node.querySelector('dt')!).fontSize),
    value: parseFloat(getComputedStyle(node.querySelector('dd')!).fontSize),
  }))
  expect(sizes.value).toBeGreaterThan(sizes.label)
  await expect(page.locator('#comparacao')).toContainText('diferença é descritiva')
  await expect(page.locator('#boxplots-comparacao')).toContainText(
    'Mesma seleção, unidade e domínio',
  )
  await page.goto('/comparar?from=2025-10-22&to=2025-10-22')
  await expect(page.locator('#comparacao')).toContainText('Um dos times não tem observações')
  await expect(page.locator('.comparison-highlights')).toContainText('Desvio amostral exige n≥2')
})
test('os 14 pares variável/time apresentam medidas, boxplot, distribuição e interpretação coerentes', async ({
  page,
}) => {
  test.setTimeout(120_000)
  const errors: string[] = []
  page.on('pageerror', (error) => errors.push(error.message))
  for (const team of teams) {
    const summary = await (await page.request.get(`/api/v1/teams/${team}/summary`)).json()
    await page.goto(`/times/${team}`)
    for (const metric of metrics) {
      await page.getByLabel('Variável do perfil').selectOption(metric)
      const row = summary.results.find((r: { metric: string }) => r.metric === metric)
      const table = page.getByRole('table', { name: new RegExp(`^Todas as medidas de ${metric}`) })
      await expect(table.getByRole('row')).toHaveCount(15)
      await expect(table).toContainText(number(row.statistics.mean.value))
      await expect(table).toContainText(number(row.statistics.q1.value))
      await expect(table).toContainText(number(row.statistics.q3.value))
      await expect(page.getByRole('img', { name: new RegExp(`^Boxplot ${metric}:`) })).toBeVisible()
      await expect(page.getByRole('img', { name: /^Histograma em densidade e KDE/ })).toBeVisible()
      await expect(page.locator('#leitura')).toContainText(
        `Média: ${number(row.statistics.mean.value)}`,
      )
      await expect(page.getByRole('region', { name: 'Filtros da análise' })).toHaveCount(0)
    }
  }
  await page.reload()
  await expect(page.getByLabel('Variável do perfil')).toHaveValue('FG3M')
  await page.setViewportSize({ width: 390, height: 844 })
  await page.screenshot({ path: 'test-results/stage9-profile-mobile.png', fullPage: true })
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true)
  expect(errors).toEqual([])
})
test('os sete métodos funcionam para os dois times, com scores ou ruído e referência fixa', async ({
  page,
}) => {
  test.setTimeout(120_000)
  await page.goto('/fora-da-curva')
  for (const team of teams) {
    await page.getByLabel('Time das anomalias').selectOption(team)
    for (const method of ['zscore', 'iqr', 'grubbs', 'ecod', 'knn', 'lof', 'dbscan']) {
      await page.getByRole('combobox', { name: 'Método', exact: true }).selectOption(method)
      await expect(page.locator('#detector')).toContainText(
        team === teams[0] ? 'Referência: 75 jogos' : 'Referência: 74 jogos',
      )
      const univariate = ['zscore', 'iqr', 'grubbs'].includes(method)
      if (univariate) await page.getByLabel('Variável do detector').selectOption('BLK')
      const url = `/api/v1/anomalies?team_id=${team}&method=${method}${univariate ? '&metric=BLK' : ''}`
      const result = (await (await page.request.get(url)).json()).result
      await expect(page.locator('#detector')).toContainText(
        `${result.outlier_count ?? 'Indefinida'} sinalizações na referência`,
      )
      await page.getByLabel('Partidas exibidas').selectOption('all')
      const table = page.getByRole('table', { name: /todas as partidas na referência completa/ })
      await expect(table.getByRole('row')).toHaveCount(result.reference_n + 1)
      if (method === 'dbscan')
        await expect(
          table.getByRole('columnheader', { name: 'Cluster', exact: true }),
        ).toBeVisible()
      else
        await expect(table.getByRole('columnheader', { name: 'Score', exact: true })).toBeVisible()
      await expect(page.getByRole('region', { name: 'Filtros da análise' })).toHaveCount(0)
    }
  }
  await page.reload()
  await expect(page.getByRole('combobox', { name: 'Método', exact: true })).toHaveValue('dbscan')
  await expect(page.getByLabel('Time das anomalias')).toHaveValue(teams[1])
  await page.screenshot({ path: 'test-results/stage9-anomalies.png', fullPage: true })
})
test('fora da curva apresenta critérios próprios, limites e sinais com precisão explícita', async ({
  page,
}) => {
  await page.goto('/fora-da-curva#time=1610612737&metodo=iqr&variavel=PTS')
  const detector = page.locator('#detector')
  await expect(page.getByText('HISTÓRICO COMPLETO DO TIME', { exact: true })).toBeVisible()
  await expect(detector).toContainText('Uma variável · PTS · Pontos')
  await expect(detector).toContainText('Cerca inferior: 87,25; cerca superior: 149,25 pontos/jogo')
  await expect(detector).toContainText('as decisões usam a precisão integral')
  await expect(detector.getByRole('table', { name: /sinalizações e candidatos/ })).toContainText(
    '22500396',
  )
  await page.getByRole('combobox', { name: 'Método', exact: true }).selectOption('grubbs')
  await expect(detector).toContainText('Valor crítico do teste global')
  await expect(detector).toContainText('Candidatos:')
  await page.getByRole('combobox', { name: 'Método', exact: true }).selectOption('lof')
  await expect(detector).toContainText('Multivariado · vetor das sete variáveis')
  await expect(detector).toContainText('Corte de score: 1,254995')
  await page.getByRole('combobox', { name: 'Método', exact: true }).selectOption('dbscan')
  await expect(detector).toContainText('Não há limiar de score contínuo')
})
test('comparação e síntese acompanham filtros e não inventam regularidade com uma observação', async ({
  page,
}) => {
  await page.goto('/comparar?from=2025-10-22&to=2025-10-22&metric=PTS')
  const stats = page.getByRole('table', {
    name: 'Pontos — comparação descritiva por partida. Mesma unidade para os dois times.',
  })
  await expect(stats).toContainText('Desvio amostral exige n≥2')
  await expect(page.locator('#comparacao')).toContainText('Um dos times não tem observações')
  await expect(page.locator('#leituras-comparacao')).toContainText('CV indisponível')
  await expect(page.getByRole('table', { name: /Quadro 7×2 de CV/ }).getByRole('row')).toHaveCount(
    8,
  )
  await page.goto('/comparar?from=2025-10-24&to=2025-10-24&metric=PTS')
  await expect(page.locator('#comparacao')).toContainText('Amostra ou medidas insuficientes')
  await expect(page.locator('#leituras-comparacao')).toContainText('CV indisponível')
  await page.goto('/?venue=home&metric=REB')
  await expect(page.locator('#sintese')).toContainText('38 jogos nesta seleção')
  await expect(page.locator('#sintese')).toContainText('35 jogos nesta seleção')
  await expect(page.locator('#contexto-completo')).toContainText('Escopo fixo: CSV completo')
  await expect(page.locator('#contexto-completo')).toContainText('149 observações em 147 jogos')
  await page.getByRole('link', { name: 'Comparar BLK', exact: true }).click()
  await expect(page).toHaveURL(/venue=home&metric=BLK/)
  await expect(page.getByRole('heading', { name: 'Tocos · Atlanta × Houston' })).toBeVisible()
  await expect(page.locator('#leituras-comparacao')).toContainText('média baixa amplifica o CV')
  await page.locator('#comparacao canvas').waitFor()
  await page.screenshot({ path: 'test-results/stage9-comparison.png', fullPage: true })
})
