# Frontend React — etapa 8

A base React já consulta a API real. Há navegação entre visão geral, perfis de Atlanta/Houston, comparação, partidas LOF de Atlanta e dicionário. As páginas são uma base de integração; o relatório acadêmico completo, os demais gráficos/métodos e as interpretações continuam na etapa 9.

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

O layout usa fundo claro, navegação escura e cores distintas para Atlanta/Houston. Fontes Manrope e DM Mono são locais; não dependem de requisições a serviços de fontes. As licenças OFL acompanham o build. O favicon é SVG do projeto. Não foram usados logotipos de terceiros.

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

O primeiro executa ESLint, Prettier, os **24 testes Vitest** e TypeScript/build de produção. O segundo regenera/verifica o contrato HTTP com a ferramenta separada em `tools/contracts/`. `make check` cobre os **236 testes Python**, incluindo os testes do pacote de deploy.

Para testes com navegador, instalar o Chromium do Playwright uma vez e gerar os dados:

```bash
npm exec --prefix frontend -- playwright install chromium
make data-build
make web-e2e
```

`web-e2e` compila o frontend e inicia API/Vite preview nas portas 8018/4178, sem reutilizar servidores já existentes. Os quatro testes cobrem dados reais, filtros, URL compartilhável, recarga profunda, seleção vazia, 503, URL inválida e navegação móvel. Os servidores de teste são encerrados ao terminar. Capturas locais ficam em `frontend/test-results/`, ignoradas pelo Git.

Em 29/10/2026, as verificações foram executadas com Node **24.22.2** e Python **3.12.13**. O gráfico ECharts produz um aviso de chunk acima de 500 kB sem compressão; ele é carregado separadamente e seu tamanho comprimido foi medido. Não houve aumento artificial do limite para ocultar o aviso. Medições, pacote e pendências de publicação estão no [guia de deploy](deployment.md).

## Validação na Vercel

Em 29/10/2026, os quatro testes de navegador também passaram em **https://quadrascope.vercel.app**, sem autenticação. Usar `E2E_BASE_URL=https://quadrascope.vercel.app npm run test:e2e --prefix frontend` para verificar a versão publicada; com essa variável, Playwright não inicia os servidores locais. A aplicação publicada foi conferida com o mesmo release de dados e os dez endpoints. [Publicação, métricas e limitação de cold start](deployment.md).

## Ajuste de escopo dos filtros em 29/10/2026

A barra foi restrita à Home e Comparação conforme pedido do usuário. Os links para as demais telas não carregam a seleção; links antigos são normalizados e os perfis mostram 75 jogos de Atlanta e 74 de Houston. A regressão de navegador verifica ausência da barra, ausência de requisição de perfil com filtro herdado, compartilhamento entre Home/Comparação e tratamento de URLs anteriores.
