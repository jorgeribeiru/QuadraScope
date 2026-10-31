import { useEffect, useRef, useState } from 'react'
import { Link, useLocation } from 'react-router-dom'
import { Copy, Search, X } from 'lucide-react'
import {
  pageForPath,
  readyQueries,
  searchReport,
  sectionHref,
  sectionIdFromHash,
} from '@/lib/report-catalog'

export function ReportIndex({ auditAvailable = true }: { auditAvailable?: boolean }) {
  const location = useLocation()
  const page = pageForPath(location.pathname)
  if (!page) return null
  const indexId = page.id === 'data' ? 'indice-dados' : 'indice-pagina'
  return (
    <nav
      id={indexId}
      className="report-index page-index"
      aria-label={`Seções de ${page.title}`}
      tabIndex={-1}
    >
      <h2>Explore por assunto</h2>
      <ul>
        {page.sections.map((section) => (
          <li key={section.id}>
            <Link
              to={sectionHref(
                location.pathname,
                !auditAvailable && ['qualidade', 'ausencias'].includes(section.id)
                  ? 'auditoria'
                  : section.id,
                location.search,
                location.hash,
              )}
            >
              <strong>{section.title}</strong>
              <span>{section.description}</span>
            </Link>
          </li>
        ))}
      </ul>
    </nav>
  )
}

export function SectionActions({ id }: { id: string }) {
  const location = useLocation()
  const page = pageForPath(location.pathname)
  const [feedback, setFeedback] = useState({ key: '', message: '' })
  const link = sectionHref(location.pathname, id, location.search, location.hash)
  const messageKey = `${location.key}:${id}`
  async function copy() {
    try {
      await navigator.clipboard.writeText(new URL(link, window.location.origin).href)
      setFeedback({ key: messageKey, message: 'Link copiado.' })
    } catch {
      setFeedback({
        key: messageKey,
        message: 'Não foi possível copiar. Abra o link da seção e copie o endereço do navegador.',
      })
    }
  }
  return (
    <div className="section-actions">
      <Link to={link}>Link desta seção</Link>
      <button
        type="button"
        onClick={() => void copy()}
        aria-label={`Copiar link da seção ${page?.sections.find((section) => section.id === id)?.title ?? id}`}
      >
        <Copy size={14} /> Copiar link
      </button>
      {page && (
        <Link
          to={sectionHref(
            location.pathname,
            page.id === 'data' ? 'indice-dados' : 'indice-pagina',
            location.search,
            location.hash,
          )}
        >
          Voltar ao índice de {page.title}
        </Link>
      )}
      <span role="status">{feedback.key === messageKey ? feedback.message : ''}</span>
    </div>
  )
}

export function SectionNavigation() {
  const location = useLocation()
  useEffect(() => {
    const id = sectionIdFromHash(location.hash)
    if (!id) return
    let cancelled = false
    let frame = 0
    let revealed: HTMLElement | null = null
    const reveal = () => {
      const target = document.getElementById(id)
      if (!target || cancelled || target === revealed) return
      // Uma seção pode chegar depois da consulta HTTP ou estar em um details fechado.
      for (let parent: HTMLElement | null = target; parent; parent = parent.parentElement) {
        if (parent instanceof HTMLDetailsElement) parent.open = true
      }
      cancelAnimationFrame(frame)
      frame = requestAnimationFrame(() => {
        if (cancelled || !target.isConnected || document.getElementById(id) !== target) return
        revealed = target
        const focus = target.querySelector<HTMLElement>('h2, h3') ?? target
        focus.setAttribute('tabindex', '-1')
        focus.focus({ preventScroll: true })
        target.scrollIntoView({ block: 'start', behavior: 'instant' })
      })
    }
    const observer = new MutationObserver(reveal)
    observer.observe(document.getElementById('conteudo') ?? document.body, {
      childList: true,
      subtree: true,
    })
    reveal()
    return () => {
      cancelled = true
      observer.disconnect()
      cancelAnimationFrame(frame)
    }
  }, [location.pathname, location.hash, location.key])
  return null
}

export function ReportSearch() {
  const dialog = useRef<HTMLDialogElement>(null)
  const input = useRef<HTMLInputElement>(null)
  const trigger = useRef<HTMLButtonElement>(null)
  const returnFocus = useRef<HTMLElement | null>(null)
  const navigating = useRef(false)
  const [query, setQuery] = useState('')
  const results = searchReport(query)
  function open() {
    returnFocus.current = trigger.current
    navigating.current = false
    if (!dialog.current?.open) dialog.current?.showModal()
    input.current?.focus()
  }
  useEffect(() => {
    const shortcut = (event: KeyboardEvent) => {
      if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === 'k') {
        event.preventDefault()
        if (dialog.current?.open) dialog.current.close()
        else {
          returnFocus.current =
            document.activeElement instanceof HTMLElement ? document.activeElement : trigger.current
          navigating.current = false
          dialog.current?.showModal()
          input.current?.focus()
        }
      }
    }
    window.addEventListener('keydown', shortcut)
    return () => window.removeEventListener('keydown', shortcut)
  }, [])
  const suggestions = readyQueries.map((entry) => ({ ...entry, category: 'Consulta pronta' }))
  return (
    <>
      <button
        ref={trigger}
        type="button"
        className="search-trigger"
        onClick={open}
        aria-label="Buscar no relatório"
        aria-haspopup="dialog"
      >
        <Search size={17} />
        <span>Buscar no relatório</span>
        <kbd>Ctrl K</kbd>
      </button>
      <dialog
        ref={dialog}
        className="report-search"
        aria-labelledby="search-title"
        aria-describedby="search-help"
        onKeyDown={(event) => {
          if (event.key === 'Escape') {
            event.preventDefault()
            event.stopPropagation()
            dialog.current?.close()
          }
        }}
        onClose={() => {
          if (!navigating.current)
            (returnFocus.current?.isConnected ? returnFocus.current : trigger.current)?.focus()
        }}
        onClick={(event) => {
          if (event.target === event.currentTarget) dialog.current?.close()
        }}
      >
        <div className="search-dialog-content">
          <div className="search-heading">
            <h2 id="search-title">Buscar no relatório</h2>
            <button type="button" onClick={() => dialog.current?.close()} aria-label="Fechar busca">
              <X size={20} />
            </button>
          </div>
          <label htmlFor="report-search-input">Assunto, variável ou método</label>
          <input
            ref={input}
            id="report-search-input"
            type="search"
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder="Ex.: tocos, Little, quartis ou assimetria"
          />
          <p id="search-help">
            Busque pelos assuntos do trabalho para encontrar a seção correspondente.
          </p>
          <p role="status">
            {query.trim()
              ? `${results.length} resultados encontrados.`
              : 'Consultas prontas para começar.'}
          </p>
          <ul className="search-results" aria-label="Resultados da busca">
            {(query.trim() ? results : suggestions).map((entry) => (
              <li key={`${entry.href}-${entry.label}`}>
                <Link
                  to={entry.href}
                  onClick={() => {
                    navigating.current = true
                    dialog.current?.close()
                  }}
                >
                  <small>{entry.category}</small>
                  <strong>{entry.label}</strong>
                  <span>{entry.description}</span>
                </Link>
              </li>
            ))}
          </ul>
          {query.trim() && results.length === 0 && (
            <p>Tente uma sigla, um nome de variável ou um assunto como “ausências”.</p>
          )}
        </div>
      </dialog>
    </>
  )
}
