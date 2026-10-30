# API FastAPI — etapa 7

A API oferece dez rotas de leitura sob `/api/v1`, exclusivamente para análise de Atlanta Hawks (`1610612737`) e Houston Rockets (`1610612745`). Os 30 times continuam no catálogo e no contexto dos jogos. A [base React](frontend.md) foi integrada na etapa 8; a [prova de hospedagem](deployment.md) tem validação local, com publicação ainda pendente.

## Executar localmente

Com Python 3.12 e uv, da raiz:

```bash
make setup
make data-build
make api-serve
```

O servidor fica em `http://127.0.0.1:8000`. Swagger em `http://127.0.0.1:8000/docs`, ReDoc em `/redoc` e contrato em `/openapi.json`. Sem Make:

```bash
uv run --locked uvicorn backend.app.main:app --host 127.0.0.1 --port 8000
```

Exemplos em outro terminal:

```bash
curl 'http://127.0.0.1:8000/api/v1/health'
curl 'http://127.0.0.1:8000/api/v1/teams/1610612737/summary?venue=home'
curl 'http://127.0.0.1:8000/api/v1/comparisons?metric=PTS&from=2026-01-01&to=2026-01-31'
curl 'http://127.0.0.1:8000/api/v1/anomalies?team_id=1610612745&method=lof&venue=away'
```

Interromper com Ctrl+C. O servidor não executa o pipeline, escreve resultados ou coleta dados da NBA. Para mudar o release, reconstruir/exportar o pacote e reiniciar o processo.

## Carregamento e disponibilidade

A factory [create_app](../../backend/app/main.py) usa lifespan para carregar uma única vez o [ArtifactRepository](../../backend/repositories/artifacts.py), validar o pacote e preparar as datas civis e o serviço científico. Importar o módulo ou exportar OpenAPI não lê artefatos.

Por padrão, a raiz do pacote é `data/processed/`, que contém `current.json` e `releases/`. Para usar o pacote reduzido:

```bash
make data-package-runtime
QUADRASCOPE_ARTIFACT_ROOT="$PWD/data/processed/runtime" make api-serve
```

O serviço funciona apenas com os dez JSONs e manifesto. Não precisa do CSV, Parquet, PyArrow, scikit-learn ou threadpoolctl no runtime. `requirements-runtime.txt` mantém FastAPI/Uvicorn/Pydantic/pandas/NumPy/SciPy; instalação isolada conforme o [guia de artefatos](artifacts.md).

O processo fixa um snapshot validado na memória. Uma mudança posterior no ponteiro ou nos arquivos não troca os dados de consultas em andamento. Reiniciar é necessário para validar/carregar outra publicação. Se o pacote inicial estiver ausente, adulterado ou incompatível, o servidor inicia com as rotas de dados e health respondendo **503**; Swagger/OpenAPI continuam acessíveis. A causa é registrada no log, e a resposta orienta gerar/validar o pacote e reiniciar, sem expor caminhos internos.

## Rotas

| Rota após `/api/v1` | Consulta / resposta |
| --- | --- |
| `/health` | Readiness, versões, dataset e release; sem parâmetros |
| `/meta` | Fonte, sete métricas, cobertura e política de runtime |
| `/dictionary` | As 28 colunas com tipos, unidades e renomeações |
| `/teams` | 30 times, abreviação derivada do confronto validado, n, período e papel `primary`/`context` |
| `/teams/{team_id}/summary` | Sete descritivas e boxplots do time na seleção |
| `/distributions` | `team_id` e `metric` obrigatórios; distribuição e descritiva/boxplot do time |
| `/comparisons` | Os dois times, CV/IQR 7×2, quartis e resumo completo; `metric=PTS` por padrão seleciona também duas linhas em `selected_summary` |
| `/anomalies` | `team_id`, `method` e combinação válida de `metric`/`features`; resultado com referência fixa e registros selecionados |
| `/quality` | Auditoria do dataset completo e recorte do grupo; sem filtros |
| `/interpretations` | `context` obrigatório, `team_id`/`metric` opcionais e filtros; informa conteúdo analítico pendente e disponibiliza teoria/proveniência |

`/comparisons` aceita `team_ids=1610612737,1610612745` em qualquer ordem e normaliza para a ordem canônica; não aceita outra seleção nem repetição. Os quadros incluem as sete variáveis, e `selected_metric` identifica a seleção para apresentação.

`/distributions` calcula classes e grade com a seleção dos dois times, reutilizando a função científica de comparação. A resposta apresenta somente a série do time solicitado, mas mantém `reference_team_ids` e `pooled_n` da construção comum. Assim, as duas consultas compartilham classes/grade quando seus filtros são iguais. A descrição e seus outliers correspondem exclusivamente ao time solicitado.

## Filtros e referência científica

Summary, distributions, comparisons, anomalies e interpretations aceitam:

| Parâmetro | Valores |
| --- | --- |
| `from`, `to` | Datas civis `YYYY-MM-DD`, limites inclusivos; `from ≤ to` |
| `venue` | `all` (padrão), `home`, `away` |
| `outcome` | `all` (padrão), `win`, `loss` |

Filtros desconhecidos, repetidos, datas inválidas, timestamps ou combinações fora da allowlist retornam 422. Os filtros são aplicados pela mesma função aos dois times; não eliminam silenciosamente observações fora do padrão nem exigem que ambos tenham o mesmo n.

Descritivas e distribuições reutilizam `describe_team`, `compare_distributions` e `descriptive_reports`. Média, variância, quartis, boxplots e tabelas são recalculados na seleção. Seleção vazia é **200** com `context.status=empty`, contagens zero, período `null` e estados/motivos por medida. Uma comparação pode ter um time vazio e outro disponível; os valores indefinidos permanecem `null`, com KDE indisponível quando necessário.

Para anomalias, `method` admite `zscore`, `iqr`, `grubbs`, `ecod`, `knn`, `lof`, `dbscan`:

- Univariados (`zscore`, `iqr`, `grubbs`) exigem `metric` entre PTS/REB/AST/STL/BLK/PF/FG3M e rejeitam `features`.
- Multivariados rejeitam `metric`; `features` pode ser omitido ou ser exatamente `PTS,REB,AST,STL,BLK,PF,FG3M`, nessa ordem.
- `k`, `eps`, escalonamento e limiares não são parâmetros HTTP editáveis. Os métodos usam o artefato revisado da etapa 5.

`result.reference`, `reference_n`, `threshold`, parâmetros, estatísticas de Grubbs, quartis e `outlier_count` continuam relativos ao histórico completo do próprio time. Os registros preservam scores, flags, clusters e demais evidências originais; somente sua exibição é filtrada. `display_n` e o campo separado `display_outlier_count` descrevem a seleção visível. Um resultado pode ter referência válida e exibição vazia; o estado da seleção está em `context.status`. Scores de times diferentes não compõem ranking absoluto comum.

Os contextos de interpretação admitidos são `overview`, `teams`, `comparisons`, `anomalies`, `quality`, `methodology`. As interpretações permanecem vazias com `interpretation_status=pending_stage_9`, inclusive quando há filtros. Os blocos de teoria e proveniência são explicitamente relativos ao dataset completo/métodos; nenhuma conclusão do histórico é reutilizada como conclusão da seleção.

## Metadados, erros e cache

Respostas analíticas contêm `context`: versões de API/schema/análise, SHA-256 da fonte, release, versão/parâmetros, times, métricas, filtros normalizados, escopo de referência, n selecionado/referência por time, período efetivo, estado e avisos. Unidades, métodos e validade acompanham os resultados científicos. Sem arredondamento intermediário, NaN ou infinito.

| Status | Significado |
| --- | --- |
| 200 | Consulta válida, inclusive sem observações |
| 304 | ETag de leitura coincide com `If-None-Match` |
| 404 | ID inexistente no dataset ou rota inexistente |
| 422 | Consulta inválida ou análise de time disponível apenas como contexto |
| 503 | Pacote obrigatório indisponível/incompatível |

Erros têm o formato `{"error":{"code":"invalid_query","message":"Consulta inválida.","details":[]}}`; detalhes de validação incluem localização, mensagem e tipo. Respostas de erro usam `Cache-Control: no-store`.

`context.cache_key` inclui endpoint, consulta normalizada completa, times/métricas, escopo, SHA da fonte, release, versões e parâmetros. Equivalências explícitas, como a ordem dos dois times e features multivariadas omitidas/canônicas, compartilham identidade. Mudanças de seleção ou release mudam a chave.

As respostas fornecem ETag derivado do payload validado e `Cache-Control: private, max-age=0, must-revalidate`. `If-None-Match` permite 304; a consulta científica ainda é composta antes da comparação. Não há cache de resultados com crescimento sem limite. O frontend usará a identidade de dataset/análise/parâmetros e todos os filtros nas chaves de consulta da etapa 8. CORS e integração com a hospedagem serão definidos nessa etapa.

## OpenAPI e tipos TypeScript

O contrato é exportado sem iniciar a API ou depender dos dados:

```bash
make api-export
```

Isso atualiza [docs/api/openapi.json](../api/openapi.json). Os schemas de respostas reutilizam os contratos científicos da etapa 6. Datas e estados são tipados; os erros documentam 404/422/503 e não se limitam a HTTP 200.

Para regenerar os tipos do frontend e conferir seu uso:

```bash
make api-contracts
```

O comando instala a ferramenta pelo lock de [tools/contracts](../../tools/contracts/package.json), executa `openapi-typescript` 7.13.0 e TypeScript 5.9.3, e atualiza [frontend/src/generated/api.ts](../../frontend/src/generated/api.ts). Node 24 é o alvo registrado; a geração também foi verificada com Node 26.12.1 disponível nesta máquina. A etapa 7 gerou os tipos; a etapa 8 adicionou a base React e seu próprio lock. Ferramentas Node não integram o runtime Python nem precisam ser instaladas para servir a API. Os testes verificam divergência do OpenAPI exportado; alterações de contrato exigem regenerar e conferir os tipos.

Referência de uso dos modelos de consulta com rejeição de extras: [documentação oficial FastAPI](https://fastapi.tiangolo.com/tutorial/query-param-models/).

## Verificação

Os [testes HTTP](../../backend/tests/api/test_api.py) incluem ambos os times, filtros equivalentes entre endpoints, medidas calculadas independentemente, datas inclusivas, n=1, seleção vazia/assimétrica, sete métodos, referência fixa, concorrência, erros, ETag e artefatos incompatíveis. `make check` executa também as suítes científicas e de publicação. A integração HTTP real é verificada com Uvicorn no ambiente reduzido; isso ainda não comprova a hospedagem da etapa 8.

Em 29/10/2026: `make check` aprovado com **232 testes**, incluindo **61 da API**, Ruff e formatação; `make api-contracts` gerou os tipos e aprovou a compilação e o exemplo de uso. Build, validação e exportação runtime aprovados. Um processo Uvicorn isolado verificou as dez rotas, estados HTTP 200/304/404/422, os 38/35 jogos em casa e a referência LOF de Houston com 74 jogos e exibição de 35. Nenhum CSV/Parquet ou dependência offline estava no pacote/ambiente. Os cenários 503 foram verificados nos testes HTTP. Evidência local gerada: `data/processed/api-runtime-verification.json`, ignorada pelo Git. A API foi encerrada ao terminar a verificação.
