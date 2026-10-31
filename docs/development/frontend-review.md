# Guia, navegação e consultas — branch melhorias

Esta etapa organiza a conferência acadêmica e a exploração dos resultados existentes. A branch `melhorias` deriva da `main` no commit `162d33f`. Não altera o backend, as fórmulas, os parâmetros, o CSV ou os artefatos científicos e não publica uma nova versão.

## Conteúdo entregue

- `/guia`: índice dos 24 requisitos na ordem adotada para o enunciado, referências às páginas do PDF, links para resultados e explicações, consultas prontas, mapa do site e roteiro de apresentação.
- Cadastro compartilhado de páginas, seções, requisitos e palavras-chave em `frontend/src/lib/report-catalog.ts`. Busca, mapa e índices usam esses mesmos destinos.
- Índices na Visão geral, nos perfis, na Comparação e em Fora da curva, integrados ao índice existente de Dados e métodos.
- Links diretos e cópia de endereço com time, variável, método, medida das barras, filtros aplicáveis e seção. Conteúdo carregado depois da consulta recebe foco; blocos recolhidos são abertos quando são o destino.
- Busca global por assunto, sigla, time, método ou requisito, sem distinção de acentos ou maiúsculas. A busca localiza destinos cadastrados, não todas as partidas ou todo texto da aplicação.
- Consultas locais no dicionário, na qualidade por coluna, nas regras de consistência, nas partidas do detector e no inventário de métodos. Contadores e limpeza deixam explícito que o filtro muda apenas a exibição das linhas.
- Leituras organizadas em achado, evidências e implicação. O texto analítico completo recebido da API permanece disponível em um bloco expansível, sem cortes por frases ou reescrita do artefato.
- Complementos editoriais individuais para as 21 colunas fora do vetor principal, preservando o dicionário original da API.
- Rótulos de quartis, mediana, cercas e bigodes nos boxplots; valores de média, modas e outliers permanecem identificáveis.
- Barras com média, mediana, desvio amostral, CV ou IQR. Título, unidade, descrição acessível, leitura e tabela associada acompanham a seleção e usam os valores existentes da API.
- Proveniência organizada entre informações declaradas e detalhes da extração. Campos desconhecidos permanecem não informados.

O guia funciona sem consultar a API. Ele localiza evidências e explicita limitações, sem marcar os requisitos como certificados. A limitação de outliers estatísticos às sete variáveis e a ausência de confirmação de submissão no Classroom estão visíveis.

## Executar apenas o frontend

Usar Node 24 conforme `.nvmrc`. Após instalar as dependências do frontend:

```bash
npm ci --prefix frontend
QUADRASCOPE_API_PROXY=https://quadrascope.vercel.app npm run dev --prefix frontend
```

Abrir `http://127.0.0.1:5173/guia`. O proxy encaminha as consultas para a API existente; ele não inicia o backend nem executa o pipeline. A URL pode ser substituída por outra instância existente compatível. A disponibilidade dos resultados depende dessa instância; o guia e a busca de assuntos continuam locais.

## Verificações desta etapa

```bash
npm run check --prefix frontend
npm exec --prefix frontend -- playwright install firefox
E2E_API_PROXY=https://quadrascope.vercel.app E2E_BROWSER=firefox npm run test:e2e --prefix frontend
```

`E2E_API_PROXY` inicia apenas a prévia do frontend local e reutiliza a API informada. Isso é diferente de `E2E_BASE_URL`, que testa uma interface já publicada. O navegador padrão continua Chromium; `E2E_BROWSER=firefox` permite verificar o projeto neste ambiente Bazzite com Firefox.

Nesse modo, somente a auditoria que invoca Python e exige artefatos locais é explicitamente ignorada. Os testes de navegação, dados, gráficos, seleções, estados de falha, acessibilidade e os novos percursos do guia continuam ativos. Nenhum teste recompõe os artefatos a partir das respostas HTTP.

Não usar `make run`, `make ci` ou os comandos de build de dados para validar esta etapa: esses fluxos incluem geração de artefatos. O workflow de CI completo existente também os gera quando acionado; não foi executado por esta alteração local.

Validação concluída em 31/10/2026:

- ESLint, Prettier, TypeScript e build aprovados.
- 31 testes Vitest aprovados, incluindo consultas combinadas, cópia de link e compatibilidade dos fragmentos de URL.
- 32 cenários de navegador aprovados em Firefox 157: os 26 cenários anteriores que não dependem de auditoria Python e os seis novos cenários do guia. A auditoria Python foi explicitamente ignorada pelo modo de API existente.
- Na rodada completa, 30 cenários passaram e dois seletores antigos ficaram ambíguos após a inclusão da tabela das barras e do ícone de cópia. Os seletores foram ajustados para identificar a tabela descritiva e o SVG científico; os dois cenários passaram na execução direcionada posterior. Nenhuma alteração no frontend foi necessária nessa correção dos seletores.
- As verificações de navegador incluem os 14 pares time/variável, sete métodos nos dois times, recarga e histórico, respostas atrasadas, troca de release, vazio/erro, teclado, foco, refluxo e acessibilidade automatizada. A busca e o guia foram incluídos nas verificações automatizadas de acessibilidade.
- Identidade pública conferida antes e depois, sem alteração; os 75 arquivos de referência permaneceram com os mesmos hashes e nenhum artefato foi criado em `data/processed/`.

A suíte Python e o navegador Chromium não foram executados nesta etapa. O aviso de tamanho de chunks do Vite continua visível; não foi ocultado por ajuste de limiar.

## Redação na voz do grupo

Após a primeira revisão da interface, ajustamos a redação para que o relatório apresente o trabalho na voz dos autores, em primeira pessoa do plural. O guia funciona como sumário dos assuntos estudados, e não como uma avaliação externa de cumprimento dos requisitos.

Retiramos da interface as frases sobre certificação, responsabilidade de submissão e confirmação de decisões pelo grupo. Os identificadores R01–R24 continuam nos links e metadados internos; a apresentação usa a numeração dos itens. As limitações de cobertura, ausência de dados e alcance dos detectores permanecem descritas como escolhas e condições da nossa análise. Informações desconhecidas da coleta continuam não informadas.

Também revimos os textos dos perfis, da comparação, dos detectores e do dicionário. Os destaques automáticos passaram a se concentrar nos valores numéricos, preservando o conteúdo e as ênfases explícitas dos textos. Os cálculos e os artefatos científicos não foram alterados.

Nesta revisão, lint, formatação, TypeScript, build e os 31 testes unitários passaram. A rodada completa de navegador terminou com 32 cenários aprovados e a mesma auditoria Python explicitamente ignorada, sem geração de dados. A prévia de desenvolvimento também foi conferida com a nova redação.

## Identidade e preservação dos dados

Referência pública consultada em 31/10/2026:

| Campo | Valor |
| --- | --- |
| API, schema e análise | `1.0.0` |
| Release | `7918f3f61a80525e5097ee878e7554e105a7eac5be9f8b22b3542f76238e39ad` |
| SHA-256 do CSV | `fa56bf638ef18be972a88850719043953e615bf39339671a8daa007ba08811b6` |

Os hashes de 75 arquivos versionados de backend, dados, templates de publicação e dependências Python foram registrados antes do trabalho e comparados durante a validação. `data/processed/` continha somente `.gitkeep`; esta etapa não gerou arquivos nesse diretório.

## Preparar uma publicação futura

O checkout atual não contém o pacote científico completo nem `.deployment/`. O frontend pode ser revisado e testado com o proxy acima.

Para publicar posteriormente sem recalcular os dados:

1. Recuperar uma cópia íntegra do pacote/release já produzido, de um backup ou do ambiente que preparou a publicação atual.
2. Conferir seu manifesto e sua identidade contra a referência acima. Manter o pacote fora do versionamento conforme a política existente.
3. Compilar o frontend e reutilizar esse release na preparação do pacote, seguindo o guia de publicação. O empacotador copia o release existente; não precisa recalculá-lo.
4. Conferir API, frontend, links profundos e identidade do release no candidato de publicação antes de promover a versão.

Não reconstruir um pacote científico pelas respostas da API nem executar `make data-build` como substituto da recuperação. A publicação fica para uma etapa posterior e depende de um pacote existente validado.
