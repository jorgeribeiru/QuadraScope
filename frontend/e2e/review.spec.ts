import { test, expect } from '@playwright/test'
import AxeBuilder from '@axe-core/playwright'
import { readFileSync } from 'node:fs'
import { execFileSync } from 'node:child_process'
import { fileURLToPath } from 'node:url'

const routes = [
  '/',
  '/times/1610612737',
  '/times/1610612745',
  '/comparar',
  '/fora-da-curva',
  '/dados',
]

test('auditoria automática de acessibilidade nas seis telas, com gráficos carregados', async ({
  page,
}, testInfo) => {
  test.setTimeout(120_000)
  const reports = []
  for (const route of routes) {
    await page.goto(route)
    await expect(page.getByRole('heading', { level: 1 })).toBeVisible()
    await expect(page.locator('main .loading')).toHaveCount(0)
    if (route === '/' || route === '/comparar') await page.locator('canvas').first().waitFor()
    if (route.includes('/times/')) await expect(page.locator('.scientific-chart')).toHaveCount(2)
    await page.screenshot({
      path: testInfo.outputPath(`${route.replaceAll('/', '_') || 'home'}.png`),
      fullPage: true,
    })
    const result = await new AxeBuilder({ page })
      .withTags(['wcag2a', 'wcag2aa', 'wcag21aa', 'wcag22aa'])
      .analyze()
    const supplementalColors = []
    for (const issue of result.incomplete.filter((r) => r.id === 'color-contrast')) {
      for (const node of issue.nodes) {
        const selector = node.target.join(' ')
        const sample = await page.locator(selector).evaluate((element) => {
          const css = getComputedStyle(element)
          let parent: Element | null = element,
            background = 'rgb(255, 255, 255)'
          while (parent) {
            const candidate = getComputedStyle(parent).backgroundColor
            if (candidate !== 'transparent' && candidate !== 'rgba(0, 0, 0, 0)') {
              background = candidate
              break
            }
            parent = parent.parentElement
          }
          const color = element instanceof SVGTextElement ? css.fill : css.color
          const luminance = (value: string) => {
            const channels = (value.match(/[\d.]+/g) ?? [])
              .slice(0, 3)
              .map(Number)
              .map((v) => v / 255)
              .map((v) => (v <= 0.04045 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4))
            return channels[0] * 0.2126 + channels[1] * 0.7152 + channels[2] * 0.0722
          }
          const values = [luminance(color), luminance(background)].sort((a, b) => b - a)
          const large =
            parseFloat(css.fontSize) >= 24 ||
            (parseFloat(css.fontSize) >= 18.66 && parseInt(css.fontWeight) >= 700)
          return {
            color,
            background,
            ratio: (values[0] + 0.05) / (values[1] + 0.05),
            minimum: large ? 3 : 4.5,
          }
        })
        supplementalColors.push({ selector, ...sample })
        expect(sample.ratio, selector).toBeGreaterThanOrEqual(sample.minimum)
      }
    }
    reports.push({
      route,
      supplementalColors,
      violations: result.violations,
      incomplete: result.incomplete.map((issue) => ({
        id: issue.id,
        nodes: issue.nodes.map((node) => node.target),
      })),
    })
  }
  await testInfo.attach('accessibility.json', {
    body: JSON.stringify(reports, null, 2),
    contentType: 'application/json',
  })
  expect(
    reports.flatMap((r) =>
      r.violations.map((v) => ({
        route: r.route,
        id: v.id,
        impact: v.impact,
        nodes: v.nodes.map((n) => ({ target: n.target, summary: n.failureSummary })),
      })),
    ),
  ).toEqual([])
})

test('cada outlier do boxplot e cada sinalização dos sete métodos coincide com o CSV', async ({
  page,
}, testInfo) => {
  test.setTimeout(180_000)
  const output = testInfo.outputPath('source-audit.json')
  execFileSync(
    'uv',
    ['run', '--locked', 'python', '-m', 'backend.scripts.verify_report', '--output', output],
    { cwd: fileURLToPath(new URL('../..', import.meta.url)) },
  )
  const audit = JSON.parse(readFileSync(output, 'utf8'))
  for (const pair of audit.pairs) {
    await page.goto(`/times/${pair.team_id}#variavel=${pair.metric}`)
    await expect(page.locator('#boxplot')).toBeVisible()
    const svg = page.locator('#boxplot svg')
    await expect(svg.locator('circle[tabindex="0"]')).toHaveCount(pair.boxplot_outlier_ids.length)
    await expect(svg).toContainText(pair.unit)
    await page.locator('#distribuicao details summary').click()
    await expect(
      page.getByRole('columnheader', { name: `Densidade (1/(${pair.unit}))`, exact: true }),
    ).toBeVisible()
    for (const id of pair.boxplot_outlier_ids) {
      const row = audit.flagged_records.find(
        (r: { method: string; team_id: string; metric: string; game_id: string }) =>
          r.method === 'iqr' &&
          r.team_id === pair.team_id &&
          r.metric === pair.metric &&
          r.game_id === id,
      )
      await expect(svg.locator('circle[tabindex="0"]').filter({ hasText: `ID ${id}` })).toHaveCount(
        1,
      )
      const table = page.getByRole('table', {
        name: new RegExp(`^Partidas fora das cercas IQR de ${pair.metric}`),
      })
      const cells = table
        .getByRole('row')
        .filter({ has: page.getByRole('cell', { name: id, exact: true }) })
      await expect(cells).toContainText(row.matchup)
      await expect(cells).toContainText(
        row.values[pair.metric].toLocaleString('pt-BR', {
          minimumFractionDigits: 2,
          maximumFractionDigits: 2,
        }),
      )
    }
  }
  for (const team of ['1610612737', '1610612745']) {
    for (const method of ['zscore', 'iqr', 'grubbs', 'ecod', 'knn', 'lof', 'dbscan']) {
      for (const metric of ['zscore', 'iqr', 'grubbs'].includes(method)
        ? ['PTS', 'REB', 'AST', 'STL', 'BLK', 'PF', 'FG3M']
        : ['']) {
        await page.goto(
          `/fora-da-curva#time=${team}&metodo=${method}${metric ? `&variavel=${metric}` : ''}`,
        )
        const flagged = audit.flagged_records.filter(
          (r: { team_id: string; method: string; metric: string | null }) =>
            r.team_id === team && r.method === method && r.metric === (metric || null),
        )
        const candidates = audit.grubbs_candidates.filter(
          (r: { team_id: string; method: string; metric: string | null }) =>
            r.team_id === team && r.method === method && r.metric === (metric || null),
        )
        const shown = new Set([...flagged, ...candidates].map((r) => r.game_id))
        if (shown.size) {
          const table = page.locator('#detector table')
          await expect(table.getByRole('row')).toHaveCount(shown.size + 1)
          for (const id of shown) {
            const original = [...flagged, ...candidates].find((r) => r.game_id === id)
            const line = table
              .getByRole('row')
              .filter({ has: page.getByRole('cell', { name: id, exact: true }) })
            await expect(line).toContainText(original.matchup)
            await expect(line).toContainText(original.game_date.split('-').reverse().join('/'))
            for (const value of Object.values(original.values) as number[]) {
              await expect(line).toContainText(
                value.toLocaleString('pt-BR', {
                  minimumFractionDigits: 2,
                  maximumFractionDigits: 2,
                }),
              )
            }
            const score =
              method === 'dbscan'
                ? '−1 · ruído'
                : original.score === null
                  ? '—'
                  : original.score.toLocaleString('pt-BR', { maximumFractionDigits: 6 })
            await expect(line).toContainText(score)
            const decision =
              original.is_outlier === null
                ? 'Indefinida'
                : original.is_outlier
                  ? 'Sinalizada'
                  : 'Não sinalizada'
            await expect(line.getByRole('cell', { name: decision, exact: true })).toHaveCount(1)
          }
        } else
          await expect(page.locator('#detector')).toContainText(
            'Nenhuma partida sinalizada ou candidata',
          )
      }
    }
  }
  await testInfo.attach('csv-proof.json', { path: output, contentType: 'application/json' })
})

test('teclado, menu móvel, tabelas e página atual nos dois perfis', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 })
  await page.goto('/')
  await page.keyboard.press('Tab')
  await expect(page.getByRole('link', { name: 'Pular para o conteúdo' })).toBeFocused()
  await page.keyboard.press('Enter')
  await expect(page.locator('main')).toBeFocused()
  const menu = page.getByRole('button', { name: 'Alternar navegação' })
  await menu.focus()
  await page.keyboard.press('Enter')
  await expect(page.locator('aside .brand')).toBeFocused()
  await page.keyboard.press('Escape')
  await expect(menu).toBeFocused()
  await expect(menu).toHaveAttribute('aria-expanded', 'false')
  await page.keyboard.press('Enter')
  await page.keyboard.press('Tab')
  await page.keyboard.press('Tab')
  await expect(page.getByRole('link', { name: 'Perfil dos times', exact: true })).toBeFocused()
  await page.keyboard.press('Enter')
  await expect(page.locator('main')).toBeFocused()
  await expect(page.getByRole('table', { name: /^Todas as medidas/ })).toBeVisible()
  const variable = page.getByLabel('Variável do perfil')
  await variable.focus()
  await variable.press('Home')
  await variable.press('ArrowDown')
  await expect(variable).toHaveValue('REB')
  await expect(page.getByRole('table', { name: /^Todas as medidas de REB/ })).toBeVisible()
  const graph = page.locator('#boxplot figure')
  await graph.focus()
  await graph.press('ArrowRight')
  await expect.poll(() => graph.evaluate((el) => el.scrollLeft)).toBeGreaterThan(0)
  await page.getByRole('link', { name: 'Houston Rockets', exact: true }).focus()
  await page.keyboard.press('Enter')
  await expect(variable).toHaveValue('REB')
  await page.setViewportSize({ width: 1280, height: 900 })
  await expect(page.getByRole('link', { name: 'Perfil dos times', exact: true })).toHaveAttribute(
    'aria-current',
    'page',
  )
  for (const table of await page.getByRole('table').all()) {
    await expect(table.locator('caption')).not.toBeEmpty()
    expect(await table.locator('th:not([scope="col"])').count()).toBe(0)
  }
})

test('contraste de textos SVG e limites das barras do histograma', async ({ page }, testInfo) => {
  await page.goto('/times/1610612737')
  await expect(page.locator('#distribuicao svg')).toBeVisible()
  const colors = await page.locator('#distribuicao').evaluate((section) => {
    const bg = getComputedStyle(section).backgroundColor
    return {
      bg,
      texts: Array.from(section.querySelectorAll('svg text')).map(
        (text) => getComputedStyle(text).fill,
      ),
      bars: Array.from(section.querySelectorAll('svg rect')).map((bar) => ({
        fill: getComputedStyle(bar).fill,
        stroke: getComputedStyle(bar).stroke,
      })),
    }
  })
  const luminance = (color: string) => {
    const rgb = (color.match(/[\d.]+/g) ?? [])
      .slice(0, 3)
      .map(Number)
      .map((v) => v / 255)
      .map((v) => (v <= 0.04045 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4))
    return rgb[0] * 0.2126 + rgb[1] * 0.7152 + rgb[2] * 0.0722
  }
  const contrast = (a: string, b: string) => {
    const values = [luminance(a), luminance(b)].sort((x, y) => y - x)
    return (values[0] + 0.05) / (values[1] + 0.05)
  }
  const textRatios = colors.texts.map((color) => contrast(color, colors.bg))
  const shapeRatios = colors.bars.map((bar) =>
    Math.max(
      contrast(bar.fill, colors.bg),
      bar.stroke === 'none' ? 0 : contrast(bar.stroke, colors.bg),
    ),
  )
  await testInfo.attach('chart-contrast.json', {
    body: JSON.stringify({ colors, textRatios, shapeRatios }, null, 2),
    contentType: 'application/json',
  })
  expect(Math.min(...textRatios)).toBeGreaterThanOrEqual(4.5)
  expect(Math.min(...shapeRatios)).toBeGreaterThanOrEqual(3)
})

test('menu móvel aberto não permite foco oculto atrás da navegação', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 })
  await page.goto('/')
  await page.getByRole('button', { name: 'Alternar navegação' }).click()
  await expect(page.locator('aside .brand')).toBeFocused()
  for (let i = 0; i < 12; i++) {
    await page.keyboard.press('Tab')
    expect(await page.evaluate(() => Boolean(document.activeElement?.closest('main')))).toBe(false)
  }
  await page.keyboard.press('Escape')
  await expect(page.getByRole('button', { name: 'Alternar navegação' })).toBeFocused()
  await page.getByRole('button', { name: 'Alternar navegação' }).click()
  await page.setViewportSize({ width: 1280, height: 900 })
  await expect(page.locator('main')).not.toHaveAttribute('inert', '')
  await page.locator('main').focus()
  await expect(page.locator('main')).toBeFocused()
})

test('jornada Dados → Perfil → Comparação → Anomalias → Síntese nos dois times', async ({
  page,
}, testInfo) => {
  test.setTimeout(120_000)
  const evidence = []
  const errors: string[] = []
  page.on('pageerror', (error) => errors.push(error.message))
  const capture = async (team: string, step: string) => {
    await expect(page.locator('main .loading')).toHaveCount(0)
    evidence.push({
      team,
      step,
      url: page.url(),
      headings: await page.locator('main h1, main h2').allTextContents(),
    })
  }
  for (const team of ['1610612737', '1610612745']) {
    await page.goto('/dados')
    await expect(page.getByRole('table', { name: /^Dicionário completo/ })).toBeVisible()
    await capture(team, 'dados')
    await page.getByRole('link', { name: 'Perfil dos times', exact: true }).click()
    if (team === '1610612745')
      await page.locator('main').getByRole('link', { name: 'Houston Rockets', exact: true }).click()
    await page.getByLabel('Variável do perfil').selectOption('STL')
    await expect(page.getByRole('table', { name: /^Todas as medidas de STL/ })).toBeVisible()
    await capture(team, 'perfil')
    await page.getByRole('link', { name: 'Comparação', exact: true }).click()
    await page.getByRole('combobox', { name: 'Mando', exact: true }).selectOption('home')
    await page.getByRole('button', { name: 'Aplicar', exact: true }).click()
    await expect(page.getByRole('table', { name: /Quadro 7×2 de CV/ })).toBeVisible()
    await capture(team, 'comparacao')
    await page.getByRole('link', { name: 'Fora da curva', exact: true }).click()
    await page.getByLabel('Time das anomalias').selectOption(team)
    await page.getByRole('combobox', { name: 'Método', exact: true }).selectOption('iqr')
    await page.getByLabel('Variável do detector').selectOption('STL')
    await expect(page.locator('#detector')).toContainText(
      `Referência: ${team === '1610612737' ? 75 : 74} jogos`,
    )
    await expect(page.getByRole('region', { name: 'Filtros da análise' })).toHaveCount(0)
    await capture(team, 'anomalias')
    await page.getByRole('link', { name: 'Visão geral', exact: true }).click()
    await expect(page.locator('#contexto-completo')).toContainText('149 observações em 147 jogos')
    await capture(team, 'sintese')
  }
  expect(errors).toEqual([])
  await testInfo.attach('journey.json', {
    body: JSON.stringify({ evidence, errors }, null, 2),
    contentType: 'application/json',
  })
})

test('refluxo em 320/390/768 px e todas as modas, inclusive coincidentes com a mediana', async ({
  page,
}, testInfo) => {
  test.setTimeout(120_000)
  const evidence = []
  for (const width of [320, 390, 768]) {
    await page.setViewportSize({ width, height: 900 })
    for (const path of routes) {
      await page.goto(path)
      await expect(page.getByRole('heading', { level: 1 })).toBeVisible()
      await expect(page.locator('main .loading')).toHaveCount(0)
      const dimensions = await page.evaluate(() => ({
        width: innerWidth,
        scroll: document.documentElement.scrollWidth,
      }))
      expect(dimensions.scroll).toBeLessThanOrEqual(dimensions.width)
      evidence.push({ path, ...dimensions })
    }
  }
  await page.setViewportSize({ width: 1280, height: 900 })
  await page.goto('/times/1610612737#variavel=STL')
  const figure = page.locator('#boxplot svg')
  const mode = figure.locator('circle').filter({ hasText: 'Moda 9,00' })
  await expect(mode).toHaveCount(1)
  const median = figure.locator('line').filter({ hasText: 'Mediana 9,00' })
  expect(Number(await mode.getAttribute('cx'))).toBeCloseTo(
    Number(await median.getAttribute('x1')),
    8,
  )
  expect(Number(await mode.getAttribute('cy'))).toBeGreaterThan(
    Number(await median.getAttribute('y2')),
  )
  await page.locator('#boxplot').screenshot({ path: testInfo.outputPath('coincident-modes.png') })
  await page.goto('/times/1610612745#variavel=PTS')
  await expect(page.locator('#boxplot svg circle').filter({ hasText: /Moda / })).toHaveCount(4)
  const table = page.getByRole('table', { name: /^Todas as medidas de PTS/ })
  for (const value of ['111,00', '117,00', '119,00', '124,00'])
    await expect(table).toContainText(value)
  await page.locator('#boxplot').screenshot({ path: testInfo.outputPath('four-modes.png') })
  await testInfo.attach('viewport-sizes.json', {
    body: JSON.stringify(evidence, null, 2),
    contentType: 'application/json',
  })
})

test('interpretação explicita destaques de CV/assimetria e diagnóstico sem mudar as medidas', async ({
  page,
}) => {
  await page.goto('/comparar')
  const highlights = page.locator('#destaques-variaveis')
  await expect(highlights).toContainText('Maior dispersão relativa pelo CV')
  await expect(highlights).toContainText('BLK (Tocos)')
  await expect(highlights).toContainText('Maior assimetria em magnitude')
  await page.goto('/times/1610612737#variavel=REB')
  await expect(page.locator('#leitura')).toContainText('Diagnóstico de sensibilidade')
  await expect(page.locator('#leitura')).toContainText('6,55 em vez de 6,82')
  await expect(page.locator('#leitura')).toContainText('9,00 em vez de 9,00')
  await expect(page.locator('#leitura')).toContainText('não remove linhas')
  await expect(page.getByRole('table', { name: /^Todas as medidas de REB/ })).toContainText('6,82')
})
