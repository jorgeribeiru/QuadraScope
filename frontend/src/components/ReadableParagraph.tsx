import { Children, type ComponentProps, type ReactNode } from 'react'

// Destaques são apenas apresentação: o texto recebido continua íntegro e na mesma ordem.
const highlights =
  /(?<![\p{L}\p{N}_])(?:histórico completo|históricos completos|seleção atual|seleção aplicada|base completa|recorte Atlanta\/Houston|referência fixa|média|mediana|desvio padrão amostral|desvio padrão|desvio amostral|variância amostral|assimetria ajustada|amplitude total|amplitude|quartis|outliers|outlier|sinalizações|sinalização|cerca inferior|cerca superior|cercas|bigodes|causalidade|superioridade global|superioridade|significância estatística|não comprova|não demonstra|não equivale|não identifica|não há|não são|não é|não se aplica|não aplicável|não executado|não calculados|não informada|IQR|CV|MCAR|MAR|MNAR|KDE|Z-score|Grubbs|DBSCAN|ECOD|LOF|k-NN|\d+(?:[.,]\d+)*(?:\s*%|\s*(?:pontos|rebotes|assistências|roubos|tocos|faltas|cestas)\/jogo|\s*(?:jogos|partidas|observações|variáveis|colunas|registros|células))?)(?![\p{L}\p{N}_])/giu

function emphasizeText(children: ReactNode): ReactNode {
  return Children.map(children, (child) => {
    if (typeof child !== 'string') return child
    const parts = child.split(highlights)
    const matches = child.match(highlights) ?? []
    return parts.flatMap((part, index) =>
      index < matches.length ? [part, <strong key={index}>{matches[index]}</strong>] : [part],
    )
  })
}

export function ReadableText({ children }: { children: ReactNode }) {
  return <>{emphasizeText(children)}</>
}

export function ReadableParagraph({ children, ...props }: ComponentProps<'p'>) {
  return <p {...props}>{emphasizeText(children)}</p>
}
