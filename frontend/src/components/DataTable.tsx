import {
  flexRender,
  getCoreRowModel,
  getSortedRowModel,
  useReactTable,
  type ColumnDef,
  type SortingState,
} from '@tanstack/react-table'
import { useId, useMemo, useState } from 'react'
import { ArrowDown, ArrowUp } from 'lucide-react'
import { normalizeSearch } from '@/lib/report-catalog'

export function DataTable<T>({
  data,
  columns,
  caption,
  search,
  filters,
}: {
  data: T[]
  columns: ColumnDef<T>[]
  caption: string
  search?: { label: string; placeholder?: string; text: (row: T) => string }
  filters?: {
    id: string
    label: string
    options: { value: string; label: string }[]
    value: (row: T) => string
  }[]
}) {
  const [sorting, setSorting] = useState<SortingState>([])
  const [query, setQuery] = useState('')
  const [selected, setSelected] = useState<Record<string, string>>({})
  const controlsId = useId()
  const controls = filters ?? []
  const visible = useMemo(() => {
    const terms = normalizeSearch(query).split(' ').filter(Boolean)
    return data.filter(
      (row) =>
        (!search || terms.every((term) => normalizeSearch(search.text(row)).includes(term))) &&
        (filters ?? []).every(
          (filter) => !selected[filter.id] || filter.value(row) === selected[filter.id],
        ),
    )
  }, [data, query, search, selected, filters])
  // eslint-disable-next-line react-hooks/incompatible-library -- React Compiler não está habilitado; TanStack gerencia suas funções.
  const table = useReactTable({
    data: visible,
    columns,
    state: { sorting },
    onSortingChange: setSorting,
    getCoreRowModel: getCoreRowModel(),
    getSortedRowModel: getSortedRowModel(),
  })
  return (
    <div className="data-table">
      {(search || controls.length > 0) && (
        <div className="table-tools">
          {search && (
            <label htmlFor={`${controlsId}-search`}>
              {search.label}
              <input
                id={`${controlsId}-search`}
                type="search"
                value={query}
                onChange={(event) => setQuery(event.target.value)}
                placeholder={search.placeholder ?? 'Digite para filtrar as linhas'}
              />
            </label>
          )}
          {controls.map((filter) => (
            <label key={filter.id} htmlFor={`${controlsId}-${filter.id}`}>
              {filter.label}
              <select
                id={`${controlsId}-${filter.id}`}
                value={selected[filter.id] ?? ''}
                onChange={(event) => setSelected({ ...selected, [filter.id]: event.target.value })}
              >
                <option value="">Todos</option>
                {filter.options.map((option) => (
                  <option key={option.value} value={option.value}>
                    {option.label}
                  </option>
                ))}
              </select>
            </label>
          ))}
          <button
            type="button"
            className="button button-outline button-small"
            onClick={() => {
              setQuery('')
              setSelected({})
            }}
            disabled={!query && !Object.values(selected).some(Boolean)}
          >
            Limpar consulta
          </button>
          <p role="status">
            {visible.length} de {data.length} linhas. A consulta filtra somente a exibição.
          </p>
        </div>
      )}
      <div
        className="table-scroll"
        role="region"
        tabIndex={0}
        aria-label={`Tabela rolável: ${caption}`}
      >
        <table>
          <caption>{caption}</caption>
          <thead>
            {table.getHeaderGroups().map((group) => (
              <tr key={group.id}>
                {group.headers.map((header) => (
                  <th
                    key={header.id}
                    scope="col"
                    aria-sort={
                      header.column.getIsSorted() === 'asc'
                        ? 'ascending'
                        : header.column.getIsSorted() === 'desc'
                          ? 'descending'
                          : undefined
                    }
                  >
                    {header.column.getCanSort() ? (
                      <button onClick={header.column.getToggleSortingHandler()}>
                        {flexRender(header.column.columnDef.header, header.getContext())}
                        {header.column.getIsSorted() === 'asc' ? (
                          <ArrowUp size={12} />
                        ) : header.column.getIsSorted() === 'desc' ? (
                          <ArrowDown size={12} />
                        ) : null}
                      </button>
                    ) : (
                      flexRender(header.column.columnDef.header, header.getContext())
                    )}
                  </th>
                ))}
              </tr>
            ))}
          </thead>
          <tbody>
            {table.getRowModel().rows.map((row) => (
              <tr key={row.id}>
                {row.getVisibleCells().map((cell) => (
                  <td key={cell.id}>{flexRender(cell.column.columnDef.cell, cell.getContext())}</td>
                ))}
              </tr>
            ))}
            {visible.length === 0 && (
              <tr>
                <td colSpan={columns.length}>Nenhuma linha corresponde à consulta.</td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  )
}
