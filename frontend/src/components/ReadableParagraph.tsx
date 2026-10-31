import { Children, type ComponentProps, type ReactNode } from 'react'

// Destaques são apenas apresentação: o texto recebido continua íntegro e na mesma ordem.
const highlights =
  /(?<![\p{L}\p{N}_])\d+(?:[.,]\d+)*(?:\s*%|\s*(?:pontos|rebotes|assistências|roubos|tocos|faltas|cestas)\/jogo)?(?![\p{L}\p{N}_])/giu

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
