import { AlertCircle, Inbox, LoaderCircle } from 'lucide-react'
import { ApiError } from '@/lib/api'
import { Button } from './ui/button'

export function Loading({ label = 'Carregando dados validados…' }: { label?: string }) {
  return (
    <div role="status" className="state-panel loading">
      <LoaderCircle className="spin" size={22} />
      <p>{label}</p>
      <div className="skeleton-line" />
      <div className="skeleton-line short" />
    </div>
  )
}
export function ErrorState({ error, retry }: { error: Error; retry: () => void }) {
  const unavailable = error instanceof ApiError && error.status === 503
  return (
    <div role="alert" className="state-panel error-panel">
      <AlertCircle size={24} />
      <h2>
        {unavailable
          ? 'Os dados estão temporariamente indisponíveis'
          : 'Não foi possível carregar esta consulta'}
      </h2>
      <p>{error.message}</p>
      <Button variant="outline" onClick={retry}>
        Tentar novamente
      </Button>
    </div>
  )
}
export function EmptyState() {
  return (
    <div role="status" className="state-panel">
      <Inbox size={28} />
      <h2>Nenhuma partida nesta seleção</h2>
      <p>Amplie o período ou ajuste mando e resultado para consultar outras partidas.</p>
    </div>
  )
}
export function Warning({ children }: { children: React.ReactNode }) {
  return (
    <div className="warning" role="note">
      <AlertCircle size={16} />
      <span>{children}</span>
    </div>
  )
}
export function PendingInterpretation() {
  return (
    <p className="interpretation-note">
      As medidas descrevem a seleção atual. As interpretações do relatório estão em revisão.
    </p>
  )
}
