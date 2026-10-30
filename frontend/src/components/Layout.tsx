import {
  Activity,
  ArrowUpRight,
  BarChart3,
  BookOpen,
  ChevronRight,
  Database,
  LayoutDashboard,
  PanelLeftClose,
  ScanLine,
  Users,
} from 'lucide-react'
import { Link, useLocation } from 'react-router-dom'
import { useEffect, useRef, useState, useSyncExternalStore } from 'react'
import { FilterBar } from './FilterBar'
import { teams } from '@/lib/format'
import { selectionHref, supportsFilters } from '@/lib/filters'

const navigation = [
  { to: '/', label: 'Visão geral', Icon: LayoutDashboard },
  { to: '/times/1610612737', label: 'Perfil dos times', Icon: Users },
  { to: '/comparar', label: 'Comparação', Icon: BarChart3 },
  { to: '/fora-da-curva', label: 'Fora da curva', Icon: ScanLine },
  { to: '/dados', label: 'Dados e métodos', Icon: Database },
]
const mobileQuery = '(max-width: 700px)'
function subscribeToViewport(callback: () => void) {
  const media = window.matchMedia(mobileQuery)
  media.addEventListener('change', callback)
  return () => media.removeEventListener('change', callback)
}
function mobileSnapshot() {
  return window.matchMedia(mobileQuery).matches
}
function serverSnapshot() {
  return false
}

export function Layout({ children }: { children: React.ReactNode }) {
  const location = useLocation()
  const [menuOpen, setMenuOpen] = useState(false)
  const mobile = useSyncExternalStore(subscribeToViewport, mobileSnapshot, serverSnapshot)
  const mobileMenuOpen = mobile && menuOpen
  const focusAfterClose = useRef<'content' | 'menu' | null>(null)
  const brandRef = useRef<HTMLAnchorElement>(null)
  const menuButtonRef = useRef<HTMLButtonElement>(null)
  const mainRef = useRef<HTMLElement>(null)
  useEffect(() => {
    if (mobileMenuOpen) brandRef.current?.focus()
    else if (focusAfterClose.current) {
      const target = focusAfterClose.current === 'content' ? mainRef.current : menuButtonRef.current
      target?.focus()
      focusAfterClose.current = null
    }
  }, [mobileMenuOpen])
  function closeNavigation() {
    if (menuOpen) {
      if (mobileMenuOpen) focusAfterClose.current = 'content'
      setMenuOpen(false)
    }
  }
  const active = navigation.find((item) =>
    item.to === '/'
      ? location.pathname === '/'
      : location.pathname.startsWith(item.to.split('/').slice(0, 2).join('/')),
  )
  return (
    <div
      className="app-shell"
      onKeyDown={(event) => {
        if (event.key === 'Escape' && mobileMenuOpen) {
          focusAfterClose.current = 'menu'
          setMenuOpen(false)
        }
      }}
    >
      <a className="skip-link" href="#conteudo" onClick={closeNavigation}>
        Pular para o conteúdo
      </a>
      <aside id="navegacao" className={`sidebar ${menuOpen ? 'is-open' : ''}`}>
        <Link
          ref={brandRef}
          to={selectionHref('/', location.search)}
          className="brand"
          onClick={closeNavigation}
        >
          <img src="/favicon.svg" alt="" width="36" height="36" />
          <span>
            QuadraScope<small>O JOGO EM DADOS</small>
          </span>
        </Link>
        <div className="sidebar-season">
          <span className="live-dot" />
          NBA · 2025–26<span className="season-phase">Temporada regular</span>
        </div>
        <p className="nav-label">EXPLORAR</p>
        <nav aria-label="Navegação principal">
          {navigation.map(({ to, label, Icon }) => (
            <Link
              key={to}
              to={selectionHref(to, location.search)}
              aria-current={active?.to === to ? 'page' : undefined}
              className={`nav-item ${active?.to === to ? 'active' : ''}`}
              onClick={closeNavigation}
            >
              <Icon size={19} />
              {label}
              {active?.to === to && <ChevronRight size={15} />}
            </Link>
          ))}
        </nav>
        <div className="sidebar-teams">
          <p className="nav-label">EM FOCO</p>
          {teams.map((team) => (
            <Link
              to={`/times/${team.id}`}
              className="sidebar-team"
              key={team.id}
              onClick={closeNavigation}
            >
              <img className="team-logo" src={team.logo} alt="" width="32" height="32" />
              <span>
                {team.city}
                <strong>{team.nickname}</strong>
              </span>
              <ArrowUpRight size={15} />
            </Link>
          ))}
        </div>
        <div className="sidebar-footer">
          <BookOpen size={18} />
          <div>
            Laboratório de Ciência de Dados<small>UFAPE · 2026.2</small>
          </div>
        </div>
      </aside>
      <div className="workspace">
        <header className="topbar">
          <div>
            <button
              ref={menuButtonRef}
              className="menu-toggle"
              aria-label="Alternar navegação"
              aria-expanded={menuOpen}
              aria-controls="navegacao"
              onClick={() => setMenuOpen(!menuOpen)}
            >
              <PanelLeftClose size={20} />
            </button>
            <span className="breadcrumb">RELATÓRIO NBA</span>
            <ChevronRight size={14} />
            <span>{active?.label || 'Página'}</span>
          </div>
          <span className="topbar-status">
            <Activity size={15} />
            Análise descritiva
          </span>
        </header>
        <main ref={mainRef} id="conteudo" tabIndex={-1} inert={mobileMenuOpen}>
          <div className="page-heading">
            <div>
              <div className="eyebrow">ATLANTA HAWKS × HOUSTON ROCKETS</div>
              <h1>
                {active?.to === '/'
                  ? 'O jogo, em perspectiva.'
                  : active?.label || 'Página não encontrada'}
              </h1>
              <p>Estatísticas por partida. Contexto antes da conclusão.</p>
            </div>
            <span className="season-tag">
              2025<span>—</span>26
            </span>
          </div>
          {supportsFilters(location.pathname) && <FilterBar />}
          {children}
          <footer className="page-footer">
            <span>QuadraScope · Dados reais, análise com contexto.</span>
            <a href="/api/v1/meta" target="_blank" rel="noreferrer">
              Consultar metadados <ArrowUpRight size={13} />
            </a>
          </footer>
        </main>
      </div>
    </div>
  )
}
