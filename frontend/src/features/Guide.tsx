import { Link } from 'react-router-dom'
import {
  presentationRoute,
  readyQueries,
  reportPages,
  requirements,
  sectionHref,
} from '@/lib/report-catalog'
import { teams } from '@/lib/format'
import { ReportIndex } from '@/components/ReportNavigation'
import { ReportSection } from '@/components/ReportPrimitives'

export function Guide() {
  return (
    <div className="report-stack guide-report">
      <div className="analysis-scope">
        <span className="scope-label">SOBRE O NOSSO TRABALHO</span>
        <h2>Como organizamos o projeto</h2>
        <p>
          Neste projeto, analisamos os jogos de Atlanta Hawks e Houston Rockets. Organizamos este
          guia pelos assuntos do enunciado, com links para os métodos que utilizamos, os resultados
          e nossas interpretações.
        </p>
      </div>
      <ReportIndex />
      <ReportSection id="enunciado" title="Por item do enunciado" requirements="R01–R24">
        <p>
          Reunimos abaixo os assuntos pedidos no Projeto 1. Indicamos a página do PDF e onde cada
          assunto aparece no relatório. Nos perfis, é possível alternar entre os dois times e as
          sete variáveis.
        </p>
        <nav aria-label="Itens do enunciado" className="requirement-toc">
          <ol>
            {requirements.map((item) => (
              <li key={item.id}>
                <Link to={`/guia#${item.id}`}>
                  <span>{Number(item.id.slice(1))}.</span> {item.title}
                </Link>
              </li>
            ))}
          </ol>
        </nav>
        <div className="requirement-list">
          {requirements.map((item) => (
            <article
              key={item.id}
              id={item.id}
              className="requirement-card"
              aria-labelledby={`${item.id}-title`}
            >
              <div className="requirement-meta">
                <span>Item {Number(item.id.slice(1))}</span>
                <span>PDF · p. {item.pdf}</span>
              </div>
              <h3 id={`${item.id}-title`}>{item.title}</h3>
              <p>{item.description}</p>
              <ul className="evidence-links">
                {item.destinations.map((destination) => (
                  <li key={`${destination.href}-${destination.label}`}>
                    <Link to={destination.href}>{destination.label}</Link>
                  </li>
                ))}
              </ul>
              {item.note && <p className="requirement-note">{item.note}</p>}
            </article>
          ))}
        </div>
      </ReportSection>
      <ReportSection id="consultas" title="Consultas prontas" requirements="Atalhos de consulta">
        <p>
          Separamos alguns atalhos para os resultados e métodos do trabalho. Eles abrem a análise
          com o time e a variável indicados; na Comparação, é possível ajustar o período, o mando e
          o resultado das partidas.
        </p>
        <ul className="destination-grid">
          {readyQueries.map((entry) => (
            <li key={entry.href}>
              <Link to={entry.href}>
                <strong>{entry.label}</strong>
                <span>{entry.description}</span>
              </Link>
            </li>
          ))}
        </ul>
      </ReportSection>
      <ReportSection id="mapa" title="Mapa do site" requirements="Páginas e seções">
        <div className="site-map">
          {reportPages.map((page) => (
            <article key={page.id}>
              <h3>
                <Link to={page.path}>{page.title}</Link>
              </h3>
              <p>{page.scope}</p>
              <ul>
                {page.sections.map((section) => (
                  <li key={section.id}>
                    <Link to={sectionHref(page.path, section.id)}>{section.title}</Link>
                    <span>{section.description}</span>
                  </li>
                ))}
              </ul>
              {page.id === 'profile' && (
                <div className="evidence-links">
                  {teams.map((team) => (
                    <Link key={team.id} to={`/times/${team.id}`}>
                      {team.name}
                    </Link>
                  ))}
                </div>
              )}
            </article>
          ))}
        </div>
      </ReportSection>
      <ReportSection id="roteiro" title="Roteiro de apresentação" requirements="Da base à síntese">
        <p>
          Começamos pela descrição da base e pelo tratamento dos dados. Depois, apresentamos as
          medidas de cada time, comparamos as distribuições e discutimos as partidas que se
          destacaram nos métodos de detecção de outliers.
        </p>
        <ol className="presentation-route">
          {presentationRoute.map((step) => (
            <li key={step.href}>
              <Link to={step.href}>{step.label}</Link>
            </li>
          ))}
        </ol>
      </ReportSection>
      <ReportSection id="entrega" title="Acesso e entrega do projeto" requirements="R05 · R06">
        <p>
          Desenvolvemos o QuadraScope como relatório web do nosso projeto. O código está no{' '}
          <a href="https://github.com/jorgeribeiru/QuadraScope" target="_blank" rel="noreferrer">
            repositório do grupo
          </a>
          , junto com o README e as instruções para executar o sistema com <code>make install</code>{' '}
          e <code>make run</code>.
        </p>
        <p>
          O enunciado pede a entrega do código-fonte e do endereço da aplicação pelo Classroom.
          Neste site, reunimos as tabelas, os gráficos e a discussão dos resultados.
        </p>
        <p>
          Descrevemos a base utilizada e os registros que temos sobre a coleta em{' '}
          <Link to="/dados#origem">Origem e limites de proveniência</Link>.
        </p>
      </ReportSection>
    </div>
  )
}
