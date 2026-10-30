# Validação do redesign — 29/10/2026

Registro local das fases 2–7 do redesign. Não houve publicação nesta validação.

## Verificações executadas

- Python 3.12.13: `make check` aprovou Ruff, formatação e 244 testes. Houve um aviso de descontinuação do TestClient do Starlette sobre `httpx`.
- Node 24.22.2: `make web-check` aprovou ESLint, Prettier, 24 testes Vitest e build. O módulo de gráfico continua com aviso de chunk acima de 500 kB sem compressão.
- Playwright/Chromium: 16 testes passaram com API e dados locais. Cobrem filtros, URLs, recarga, estados vazio e de erro, perfis, gráficos e tabelas, sete detectores em ambos os times e Dados e métodos.
- `make data-validate` confirmou a integridade do release local `ddd1fb5f8683d83e602caef5846027156a5194f257491c51221a27bb3d0a8a94`.
- Visão geral, os dois perfis, Comparação, Fora da curva e Dados e métodos foram abertos nas larguras de 1440, 1280, 768 e 390 px. Não foi observado transbordamento horizontal da página; tabelas e gráficos mantêm suas próprias regiões roláveis. Também foram verificadas larguras de 640 e 320 px como teste adicional de reorganização do layout.
- Foram verificados aplicação e limpeza de filtro, preservação da seleção entre Visão geral e Comparação, transição para histórico completo, URLs inválidas, retorno do navegador, seleção vazia e indisponibilidade da API.
- O menu móvel foi testado com teclado: foco ao abrir, Escape para fechar, retorno ao botão e foco no conteúdo após escolher uma página. O índice de Dados e métodos também foi exercitado com teclado.
- Uma verificação automatizada dos pares de cores de textos renderizados identificou contrastes baixos; os pares identificados foram ajustados e a verificação repetida nas seis páginas não apontou novas falhas entre os textos mensurados.

## Limites da validação

- A verificação de contraste percorreu textos HTML renderizados e fundos opacos identificáveis; não abrange todas as combinações de estados, fundos compostos, elementos SVG/canvas, gráficos e componentes de terceiros.
- As larguras de 640 e 320 px avaliam reorganização do conteúdo em espaço reduzido, mas não substituem testes completos de zoom do navegador e ampliação de texto. Uma tentativa de automação com ampliação de página de 200% confirmou a escala, mas a interação automatizada com o botão não foi concluída; falta testar zoom real e interação manualmente.
- Não foi realizada revisão integral com leitores de tela, tecnologias assistivas, todos os navegadores ou todos os critérios WCAG 2.2 AA. Não se declara conformidade.
- Capturas locais de antes/depois foram feitas ao longo das fases e ficam em arquivos temporários da sessão; não são artefatos versionados.
