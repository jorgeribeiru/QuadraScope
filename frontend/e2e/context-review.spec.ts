import { test, expect } from '@playwright/test'

const pendingGates = new Set<() => void>()
test.afterEach(async ({ page }) => {
  for (const release of pendingGates) release()
  pendingGates.clear()
  await page.unrouteAll({ behavior: 'wait' })
})

test('troca de release e versão não conserva resultados antigos durante falha da API', async ({
  page,
}, testInfo) => {
  await page.clock.install()
  let generation = 0
  const requests: { path: string; generation: number }[] = []
  await page.route('**/api/v1/**', async (route) => {
    const own = generation,
      path = new URL(route.request().url()).pathname
    requests.push({ path, generation: own })
    if (own === 1 && path.endsWith('/comparisons')) {
      await route.fulfill({
        status: 503,
        contentType: 'application/json',
        body: JSON.stringify({
          error: {
            code: 'artifacts_unavailable',
            message: 'Falha simulada durante troca de release.',
            details: [],
          },
        }),
      })
      return
    }
    const response = await route.fetch()
    const body = await response.json()
    if (body.context && own > 0) {
      body.context.release_id = (own === 1 ? 'b' : 'c').repeat(64)
      body.context.analysis_version = `review-${own}`
    }
    await route.fulfill({ response, json: body })
  })
  await page.goto('/')
  await expect(page.getByRole('heading', { name: 'Os times em foco' })).toBeVisible()
  generation = 1
  await page.clock.fastForward(61_000)
  await expect(page.getByRole('alert').first()).toContainText('temporariamente indisponíveis')
  await expect(page.getByRole('heading', { name: 'Os times em foco' })).toHaveCount(0)
  expect(requests.some((r) => r.path.endsWith('/comparisons') && r.generation === 1)).toBe(true)
  generation = 2
  await page.clock.fastForward(61_000)
  await expect(page.getByRole('heading', { name: 'Os times em foco' })).toBeVisible()
  expect(requests.some((r) => r.path.endsWith('/comparisons') && r.generation === 2)).toBe(true)
  await testInfo.attach('release-requests.json', {
    body: JSON.stringify(requests, null, 2),
    contentType: 'application/json',
  })
})

test('resposta de outro release é rejeitada antes da apresentação e força atualizar metadados', async ({
  page,
}) => {
  let responseSent = false
  let unlock = () => {}
  const gate = new Promise<void>((resolve) => {
    unlock = resolve
    pendingGates.add(resolve)
  })
  await page.route('**/api/v1/meta', async (route) => {
    const response = await route.fetch(),
      body = await response.json()
    if (responseSent) {
      await gate
      body.context.release_id = 'b'.repeat(64)
    }
    await route.fulfill({ response, json: body })
  })
  await page.route('**/api/v1/comparisons?*', async (route) => {
    const response = await route.fetch(),
      body = await response.json()
    responseSent = true
    body.context.release_id = 'b'.repeat(64)
    await route.fulfill({ response, json: body })
  })
  await page.route('**/api/v1/interpretations?*', async (route) => {
    const response = await route.fetch(),
      body = await response.json()
    body.context.release_id = 'b'.repeat(64)
    await route.fulfill({ response, json: body })
  })
  await page.goto('/')
  await expect(page.getByRole('alert')).toContainText('Os dados foram atualizados')
  await expect(page.getByRole('heading', { name: 'Os times em foco' })).toHaveCount(0)
  unlock()
  await expect(page.getByRole('heading', { name: 'Os times em foco' })).toBeVisible()
})

test('resposta atrasada de um filtro anterior não substitui a seleção aplicada depois', async ({
  page,
}) => {
  let unlock = () => {},
    received = false,
    settled = false
  const gate = new Promise<void>((resolve) => {
    unlock = resolve
    pendingGates.add(resolve)
  })
  await page.route('**/api/v1/comparisons?*', async (route) => {
    const response = await route.fetch()
    const old = new URL(route.request().url()).searchParams.get('venue') === 'home'
    if (old) {
      received = true
      await gate
    }
    try {
      await route.fulfill({ response })
    } finally {
      if (old) settled = true
    }
  })
  await page.goto('/comparar')
  await expect(page.locator('#comparacao table')).toBeVisible()
  await page.getByRole('combobox', { name: 'Mando', exact: true }).selectOption('home')
  await page.getByRole('button', { name: 'Aplicar', exact: true }).click()
  await expect.poll(() => received).toBe(true)
  await page.getByRole('combobox', { name: 'Mando', exact: true }).selectOption('away')
  await page.getByRole('button', { name: 'Aplicar', exact: true }).click()
  await expect(page).toHaveURL(/venue=away/)
  const expected = await (await page.request.get('/api/v1/comparisons?venue=away')).json()
  const mean = expected.selected_summary[0].statistics.mean.value.toLocaleString('pt-BR', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })
  await expect(page.locator('#comparacao table')).toContainText(mean)
  unlock()
  await expect.poll(() => settled).toBe(true)
  await expect(page).toHaveURL(/venue=away/)
  await expect(page.locator('#comparacao table')).toContainText(mean)
})
