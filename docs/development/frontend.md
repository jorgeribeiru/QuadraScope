# Frontend React — etapas 8 e 9

A base React consulta a API real. Há navegação entre visão geral, perfis de Atlanta/Houston, comparação, partidas LOF de Atlanta e Dados e métodos. P9.01–P9.12 completam o relatório com perfis, gráficos, comparação, anomalias e síntese contextual. [Mapa e comportamento do relatório](report.md). Os registros abaixo preservam as verificações intermediárias; a revisão integral permanece na etapa 10.

## Executar

Pré-requisitos: Python 3.12, uv e **Node 24** registrado em `.nvmrc`. O uv gerencia o Python; o npm gerencia o frontend. Com nvm instalado, executar `nvm install` e `nvm use` na raiz. Não é necessário mudar o Python global.

Na primeira instalação, da raiz:

```bash
make setup
make web-setup
make data-build
make dev
```

Abrir **http://127.0.0.1:5173**. A API fica em **http://127.0.0.1:8000/docs**. Ctrl+C encerra os dois processos e seus subprocessos. Para iniciar separadamente, usar `make api-serve` em um terminal e `make web-dev` em outro. Portas ocupadas produzem erro; não são escolhidas outras portas silenciosamente.

`make web-setup` usa `npm ci` e o lock do frontend. `make dev` exige dependências já instaladas e um release válido; ele não executa o pipeline nem instala pacotes. Os comandos existentes de ciência e API continuam disponíveis.

Vite encaminha `/api` para `127.0.0.1:8000`, preservando a origem vista pelo navegador. Não é necessário CORS nesse fluxo. O alvo do proxy pode ser alterado no ambiente do processo Vite com `QUADRASCOPE_API_PROXY`. `VITE_API_URL`, exemplificado em [frontend/.env.example](../../frontend/.env.example), fica vazio por padrão. Definir uma origem externa exigirá configuração correspondente de CORS no backend; essa topologia não foi adotada.

## Organização e dependências

```text
frontend/
├── package.json / package-lock.json
├── vite.config.ts / tsconfig.json
├── eslint.config.js / .prettierrc.json
├── components.json                 # convenções de componentes shadcn/ui
├── public/                         # favicon SVG e licenças das fontes
├── src/
│   ├── main.tsx
│   ├── app/App.tsx                 # providers, metadados e rotas
│   ├── components/                 # layout, filtros, estados, tabela e gráfico
│   │   └── ui/button.tsx           # botão local com Radix Slot/CVA
│   ├── features/Reports.tsx        # telas iniciais de integração
│   ├── generated/api.ts            # contrato gerado do OpenAPI
│   ├── lib/                       # fetch tipado, cache, filtros, formatação
│   ├── tests/                     # Vitest + Testing Library
│   └── styles.css                 # tokens, Tailwind e layout responsivo
└── e2e/                            # navegador + API real
```

Versões resolvidas no lock: React 19.3.1, React Router 7.18.5, Vite 8.3.5, TypeScript 5.9.3, TanStack Query 5.105.0, Table 8.21.3, ECharts 6.1.0 e echarts-for-react 3.0.6. Tailwind 4, Radix Slot, CVA e componentes locais seguem a organização shadcn/ui, sem criar um segundo sistema de componentes. ESLint 10, Prettier, Vitest e Playwright verificam código e comportamento.

O layout usa fundo claro, navegação escura e cores distintas para Atlanta/Houston. Fontes Manrope e DM Mono são locais; não dependem de requisições a serviços de fontes. As licenças OFL acompanham o build. O favicon é SVG do projeto. Os escudos dos times são arquivos locais obtidos do CDN oficial da NBA: [Atlanta](https://cdn.nba.com/logos/nba/1610612737/primary/L/logo.svg) e [Houston](https://cdn.nba.com/logos/nba/1610612745/primary/L/logo.svg).

## Dados, seleção e cache

Por solicitação do usuário, os filtros `from`, `to`, `venue`, `outcome` e `metric` aparecem somente na **Home (`/`) e Comparação (`/comparar`)**. A seleção fica na URL e é preservada na navegação entre essas duas telas e na recarga; os botões voltar/avançar restauram esse contexto. Perfis, Fora da curva e Dados abrem sem filtros e consultam o histórico completo. URLs antigas dessas telas com query são normalizadas antes da consulta, para evitar filtros invisíveis. Datas são civis e inclusivas; não são convertidas em outro dia por fuso. URL inválida ou parâmetro repetido/desconhecido produz aviso e bloqueia as consultas analíticas até a correção.

O cliente `openapi-fetch` usa [os tipos gerados](../../frontend/src/generated/api.ts) da etapa 7. Os valores, estatísticas e decisões vêm do Python. O navegador formata casas decimais/unidades e apresenta gráficos e tabelas; não implementa novamente os detectores ou suas fórmulas.

As chaves TanStack Query incluem fonte, release, versões de schema/análise/parâmetros, parâmetros, endpoint e seleção completa. Metadados são revalidados ao focar a janela e a cada minuto. Mudança de release cancela e remove consultas anteriores; não é usada a seleção anterior como placeholder. Uma resposta de outro release é rejeitada e solicita atualização dos metadados. O cache não é persistido em localStorage.

Descritivas são recalculadas pela API na seleção. A prévia LOF mantém scores, flags e referência integral do time, mostrando `reference_n`/`display_n` de forma explícita. O dicionário sempre descreve a base completa e identifica que os filtros não alteram seu conteúdo. O LOF usa o vetor canônico completo e exibe todas as partidas de referência na tela atual, sem herdar a seleção da Home. Os filtros HTTP da API continuam disponíveis conforme seu próprio contrato.

## Estados e acessibilidade da base

Carregamento usa `role=status`; erros de rede/HTTP, incluindo 503, usam alerta e nova tentativa. Seleção vazia tem mensagem própria e não é apresentada como falha da API. Valores indefinidos permanecem `—`, com motivo e indicação de amostra insuficiente nas medidas pertinentes. Zero continua sendo um valor válido.

Há link para pular ao conteúdo, labels de formulário, navegação por teclado, foco visível, captions, cabeçalhos com `scope`, ordenação acessível e rolagem contida das tabelas. O gráfico tem descrição textual e tabela correspondente na comparação. A navegação móvel pode ser aberta/fechada, e o layout respeita movimento reduzido. A revisão completa de acessibilidade e do relatório continua na etapa 10.

ECharts é carregado sob demanda. O import usa `echarts-for-react/esm/core`, pois a entrada CommonJS não funcionou no build de produção Vite/Rolldown. Somente barras, eixos/grade, tooltip, acessibilidade e renderer Canvas foram registrados nesta base.

## Verificar

```bash
make web-check
make api-contracts
```

O primeiro executa ESLint, Prettier, os **24 testes Vitest** e TypeScript/build de produção. O segundo regenera/verifica o contrato HTTP com a ferramenta separada em `tools/contracts/`. `make check` cobre os **244 testes Python**, incluindo os testes do pacote de deploy.

Para testes com navegador, instalar o Chromium do Playwright uma vez e gerar os dados:

```bash
npm exec --prefix frontend -- playwright install chromium
make data-build
make web-e2e
```

`web-e2e` compila o frontend e inicia API/Vite preview nas portas 8018/4178, sem reutilizar servidores já existentes. Os onze testes locais atuais cobrem dados reais, filtros, URL compartilhável, recarga profunda, seleção vazia, 503, URL inválida e navegação móvel, além da auditoria e conteúdo completo de Dados e métodos. Os servidores de teste são encerrados ao terminar. Capturas locais ficam em `frontend/test-results/`, ignoradas pelo Git.

Em 29/10/2026, as verificações foram executadas com Node **24.22.2** e Python **3.12.13**. O gráfico ECharts produz um aviso de chunk acima de 500 kB sem compressão; ele é carregado separadamente e seu tamanho comprimido foi medido. Não houve aumento artificial do limite para ocultar o aviso. Medições, pacote e pendências de publicação estão no [guia de deploy](deployment.md).

## Validação na Vercel

Em 29/10/2026, os quatro testes de navegador também passaram em **https://quadrascope.vercel.app**, sem autenticação. Usar `E2E_BASE_URL=https://quadrascope.vercel.app npm run test:e2e --prefix frontend` para verificar a versão publicada; com essa variável, Playwright não inicia os servidores locais. A aplicação publicada foi conferida com o mesmo release de dados e os dez endpoints. [Publicação, métricas e limitação de cold start](deployment.md).

## Ajuste de escopo dos filtros em 29/10/2026

A barra foi restrita à Home e Comparação conforme pedido do usuário. Os links para as demais telas não carregam a seleção; links antigos são normalizados e os perfis mostram 75 jogos de Atlanta e 74 de Houston. A regressão de navegador verifica ausência da barra, ausência de requisição de perfil com filtro herdado, compartilhamento entre Home/Comparação e tratamento de URLs anteriores.

## Etapa 9 — Dados e métodos (P9.01–P9.02)

O primeiro incremento está implementado e verificado localmente. A versão pública permanece no P8.08; estes novos conteúdos ainda não foram publicados nem commitados. P9.03–P9.12 permanecem abertos.

[DataReport.tsx](../../frontend/src/features/DataReport.tsx) implementa `/dados` em seções navegáveis, com códigos de requisitos, tabelas acessíveis e blocos expansíveis. O dicionário, a auditoria e a documentação são carregados independentemente pela API, sempre vinculados ao release. Uma falha em qualidade não é convertida em contagem zero/aprovação e não bloqueia o dicionário válido. A documentação usa os metadados de `/interpretations?context=methodology`; não apresenta seu campo de interpretações analíticas, ainda pendente.

A tela apresenta dimensões, tamanho/codificação/delimitador, SHA-256, períodos, cobertura de todos os times e do foco, prorrogações, históricos distintos de confrontos diretos, fonte declarada e detalhes não informados. As 28 colunas incluem nomes, tipos, unidades, domínios, papéis e motivos de exclusão; W/L, WL, datas e cinco campos derivados têm explicação própria. A stack confirmada é justificada na seção de métodos.

Qualidade tem tabelas separadas para a base completa e o recorte Atlanta/Houston, preservando a diferença entre zero e não aplicável. Regras entre partidas ficam separadas dos domínios de células. Os quatro métodos de ausência mostram teoria, uso, pressupostos, motivo da inaplicabilidade e ausência de execução/estatística/p-valor; mecanismos MCAR/MAR/MNAR e limites de identificação são discutidos. Nenhuma data de extração ou completude externa foi inferida.

As tabelas possuem rolagem contida e cabeçalhos fixos para permitir leitura das 28 linhas sem tornar a página inteira uma tabela. Informações de origem não são afetadas por filtros globais; URLs antigas com query são normalizadas conforme a regra de navegação existente. A revisão integral de acessibilidade permanece na etapa 10.

Validação deste incremento em 29/10/2026: `npm run check --prefix frontend` com lint, formatação, 24 Vitest e TypeScript/build; oito Playwright com API real, incluindo dois testes novos em [data-report.spec.ts](../../frontend/e2e/data-report.spec.ts). Conferidos 75 jogos/duas prorrogações de Atlanta, 74/oito de Houston, 28 linhas por tabela, zeros de BLK (33 na base completa e zero no foco), não execução dos quatro testes e comportamento móvel/503. O backend científico e os artefatos não foram alterados nesta etapa; os 241 testes Python passaram no trabalho anterior do P8.08.

## Conclusão da etapa 9

P9.01–P9.12 implementados; organização final em `features/{Reports,DataReport,TeamReport,ComparisonReport,AnomalyReport}.tsx`. Componentes científicos SVG e leituras contextuais têm responsabilidades próprias. Seletor de variável do perfil e time/método/variável/exibição de anomalias são compartilháveis no fragmento da URL; a barra global permanece somente na Home e Comparação.

Validação local: 244 testes Python, 24 Vitest, onze Playwright, contratos, lint, formatação e build. [Critérios, métodos e casos cobertos](report.md). A etapa 10 continua aberta para revisão integral.

## Publicação do relatório completo

Em 29/10/2026, o commit `c51acd9` foi publicado em https://quadrascope.vercel.app. Os onze testes Playwright passaram sem login em 41,9 s. As afirmações de não publicação nos registros intermediários acima descrevem somente aqueles incrementos. [Deploy e evidências](deployment.md#publicação-da-etapa-9--relatório-completo).

## Revisão da etapa 10

Em 30/10/2026: 245 testes Python, 25 Vitest e 27 Playwright aprovados. Correções locais de foco móvel, navegação, semântica e contraste; unidades e leituras complementadas frente ao PDF. O axe é uma dependência de desenvolvimento fixada no lock e não é incluído no runtime da aplicação. Contrastes incompletos foram confrontados pelas cores computadas; não se declara certificação WCAG. [Revisão, limites e reprodução](validation.md). Alterações desta etapa ainda sem commit/deploy; entrega final na etapa 11.
