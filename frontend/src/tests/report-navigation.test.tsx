import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter } from 'react-router-dom'
import { describe, expect, it } from 'vitest'
import { DataTable } from '@/components/DataTable'
import { Guide } from '@/features/Guide'
import {
  normalizeSearch,
  profileHref,
  reportHashParams,
  requirements,
  searchReport,
  sectionHref,
  sectionIdFromHash,
} from '@/lib/report-catalog'
import { columnDecisions } from '@/lib/column-decisions'
import { SectionActions } from '@/components/ReportNavigation'

describe('destinos do relatório', () => {
  it('preserva seleções, filtros e a seção ao construir um link compartilhável', () => {
    expect(profileHref('1610612745', 'BLK', 'boxplot')).toBe(
      '/times/1610612745#variavel=BLK&secao=boxplot',
    )
    expect(sectionHref('/comparar', 'cv', '?venue=home&metric=REB', '#medida=iqr')).toBe(
      '/comparar?venue=home&metric=REB#medida=iqr&secao=cv',
    )
    expect(
      sectionHref(
        '/fora-da-curva',
        'inventario',
        '',
        '#time=1610612745&metodo=grubbs&variavel=STL',
      ),
    ).toBe('/fora-da-curva#time=1610612745&metodo=grubbs&variavel=STL&secao=inventario')
  })
  it('mantém âncoras antigas e ignora codificação inválida sem derrubar a navegação', () => {
    expect(sectionIdFromHash('#dicionario')).toBe('dicionario')
    expect(sectionIdFromHash('#variavel=BLK&secao=boxplot')).toBe('boxplot')
    expect(sectionIdFromHash('#variavel=BLK')).toBeNull()
    expect(sectionIdFromHash('#%E0%A4')).toBeNull()
    expect(reportHashParams('#inventario').get('secao')).toBe('inventario')
  })
  it('localiza assuntos por sigla, acento e requisito sem apresentar resultados fictícios', () => {
    expect(normalizeSearch('ASSISTÊNCIAS')).toBe('assistencias')
    expect(searchReport('tocos').some((entry) => entry.label.includes('(BLK)'))).toBe(true)
    expect(searchReport('Houston BLK').some((entry) => entry.href.includes('1610612745'))).toBe(
      true,
    )
    expect(searchReport('Little').some((entry) => entry.href === '/dados#ausencias')).toBe(true)
    expect(searchReport('R19').some((entry) => entry.href === '/guia#R19')).toBe(true)
    expect(searchReport('')).toEqual([])
    expect(searchReport('assuntoinexistente')).toEqual([])
  })
  it('organiza os 24 assuntos e apresenta as escolhas na voz do grupo', () => {
    expect(new Set(requirements.map((entry) => entry.id)).size).toBe(24)
    expect(requirements.every((entry) => entry.destinations.length > 0)).toBe(true)
    expect(requirements.find((entry) => entry.id === 'R14')?.note).toContain('sete variáveis')
    expect(requirements.find((entry) => entry.id === 'R06')?.note).toContain('código-fonte')
    expect(Object.keys(columnDecisions)).toHaveLength(21)
    render(
      <MemoryRouter initialEntries={['/guia']}>
        <Guide />
      </MemoryRouter>,
    )
    expect(screen.getByText(/Neste projeto, analisamos os jogos/)).toBeInTheDocument()
    expect(screen.queryByText(/certificação de cumprimento/)).not.toBeInTheDocument()
    expect(screen.getByRole('heading', { name: 'Mapa do site' })).toBeInTheDocument()
    expect(screen.getByRole('heading', { name: 'Síntese interpretativa' })).toBeInTheDocument()
  })
})

it('copia um link com os filtros, a medida e a seção atuais', async () => {
  const user = userEvent.setup()
  render(
    <MemoryRouter initialEntries={['/comparar?venue=home&metric=REB#medida=cv']}>
      <SectionActions id="cv" />
    </MemoryRouter>,
  )
  await user.click(screen.getByRole('button', { name: /Copiar link/ }))
  expect(await navigator.clipboard.readText()).toContain(
    '/comparar?venue=home&metric=REB#medida=cv&secao=cv',
  )
  expect(screen.getByRole('status')).toHaveTextContent('Link copiado.')
})

it('combina busca, filtro e ordenação de tabela sem alterar os dados originais', async () => {
  const user = userEvent.setup()
  const rows = [
    { column: 'BLK', label: 'Tocos', kind: 'integer', n: 75 },
    { column: 'STL', label: 'Roubos', kind: 'integer', n: 74 },
    { column: 'GAME_DATE', label: 'Data', kind: 'date', n: 149 },
  ]
  render(
    <DataTable
      data={rows}
      caption="Consulta de exemplo"
      columns={[
        { accessorKey: 'column', header: 'Coluna' },
        { accessorKey: 'n', header: 'Jogos' },
      ]}
      search={{ label: 'Buscar coluna', text: (row) => `${row.column} ${row.label}` }}
      filters={[
        {
          id: 'kind',
          label: 'Tipo',
          value: (row) => row.kind,
          options: [
            { value: 'integer', label: 'Inteiro' },
            { value: 'date', label: 'Data' },
          ],
        },
      ]}
    />,
  )
  await user.selectOptions(screen.getByLabelText('Tipo'), 'integer')
  await user.type(screen.getByLabelText('Buscar coluna'), 'TOCOS')
  expect(screen.getByRole('status')).toHaveTextContent('1 de 3 linhas')
  expect(screen.getAllByRole('row')).toHaveLength(2)
  await user.selectOptions(screen.getByLabelText('Tipo'), 'date')
  expect(screen.getByText('Nenhuma linha corresponde à consulta.')).toBeInTheDocument()
  await user.click(screen.getByRole('button', { name: 'Limpar consulta' }))
  await user.click(screen.getByRole('button', { name: 'Jogos' }))
  expect(screen.getAllByRole('row')[1]).toHaveTextContent('149')
  expect(rows.map((row) => row.n)).toEqual([75, 74, 149])
})
