import { fireEvent, render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter, useLocation } from 'react-router-dom'
import { it, expect, vi } from 'vitest'
import { FilterBar } from '@/components/FilterBar'
import { EmptyState, ErrorState, Loading } from '@/components/States'
import { ApiError } from '@/lib/api'
import { DataTable } from '@/components/DataTable'
import { ReadableParagraph } from '@/components/ReadableParagraph'

function Location() {
  const location = useLocation()
  return <output aria-label="URL">{location.search}</output>
}
it('destaca medidas sem alterar texto, ressalvas ou interpretar HTML', () => {
  const text = 'Média: 114,41 pontos/jogo. A diferença não demonstra superioridade. <teste>'
  const { container } = render(<ReadableParagraph>{text}</ReadableParagraph>)
  const paragraph = container.querySelector('p')!
  expect(paragraph.textContent).toBe(text)
  expect(paragraph.querySelectorAll('strong').length).toBeGreaterThan(0)
  expect(paragraph.querySelector('teste')).toBeNull()
})
it('grava filtros na URL e permite limpá-los', async () => {
  const user = userEvent.setup()
  render(
    <MemoryRouter initialEntries={['/?metric=REB']}>
      <FilterBar />
      <Location />
    </MemoryRouter>,
  )
  await user.selectOptions(screen.getByLabelText('Mando'), 'home')
  fireEvent.change(screen.getByLabelText('De'), { target: { value: '2026-01-01' } })
  await user.click(screen.getByRole('button', { name: 'Aplicar' }))
  expect(screen.getByLabelText('URL')).toHaveTextContent('from=2026-01-01&venue=home&metric=REB')
  await user.click(screen.getByRole('button', { name: 'Limpar filtros' }))
  expect(screen.getByLabelText('URL')).toBeEmptyDOMElement()
})
it('informa filtros inválidos sem inventar uma seleção', () => {
  render(
    <MemoryRouter initialEntries={['/?venue=neutral']}>
      <FilterBar />
    </MemoryRouter>,
  )
  expect(screen.getByRole('alert')).toHaveTextContent('Mando inválido')
})
it('distingue carregamento e seleção vazia', () => {
  const view = render(<Loading />)
  expect(screen.getByRole('status')).toHaveTextContent('Carregando')
  view.rerender(<EmptyState />)
  expect(screen.getByRole('status')).toHaveTextContent('Nenhuma partida')
})
it('mostra indisponibilidade como erro e oferece nova tentativa', async () => {
  const retry = vi.fn()
  render(
    <ErrorState
      error={new ApiError('Pacote indisponível.', 503, 'artifacts_unavailable')}
      retry={retry}
    />,
  )
  expect(screen.getByRole('alert')).toHaveTextContent('temporariamente indisponíveis')
  await userEvent.click(screen.getByRole('button', { name: 'Tentar novamente' }))
  expect(retry).toHaveBeenCalledOnce()
})
it('ordena a tabela por teclado sem perder caption ou associação de cabeçalhos', async () => {
  render(
    <DataTable
      data={[{ n: 75 }, { n: 38 }]}
      columns={[{ accessorKey: 'n', header: 'Jogos' }]}
      caption="Jogos por seleção"
    />,
  )
  expect(screen.getByRole('table', { name: 'Jogos por seleção' })).toBeInTheDocument()
  const button = screen.getByRole('button', { name: 'Jogos' })
  button.focus()
  await userEvent.keyboard('{Enter}')
  expect(screen.getByRole('columnheader')).toHaveAttribute('aria-sort', 'descending')
  expect(screen.getAllByRole('row')[1]).toHaveTextContent('75')
})
