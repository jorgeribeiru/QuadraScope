# Ambiente de desenvolvimento

Para instalar e executar o sistema completo, usar `make install` uma vez e `make run` nas execuções seguintes. O segundo comando gera e valida os artefatos antes de iniciar API + frontend. O [guia de entrega](delivery.md) documenta requisitos de sistema, CI e recuperação da hospedagem.

## Versões e dependências

| Ferramenta | Versão do projeto | Registro |
| --- | --- | --- |
| Python | 3.12.x | `.python-version` e `requires-python` no pyproject |
| Node.js | 24.x, validado com 24.22.2 | `.nvmrc` e engines/lock do frontend |
| uv | 0.11.7 usado na validação desta etapa | Gerencia `.venv`, `uv.lock` e exportação |
| GNU Make | 4.4.1 usado na validação | Atalhos no Makefile; comandos equivalentes abaixo |

Python 3.12 e Node 24 foram escolhidos entre as versões suportadas pela hospedagem prevista. A aplicação foi posteriormente publicada e verificada; [provas e limites da hospedagem](deployment.md). Referências consultadas em 29/10/2026: [Python na Vercel](https://vercel.com/docs/functions/runtimes/python), [Node na Vercel](https://vercel.com/docs/functions/runtimes/node-js/node-js-versions).

O Python global não precisa ser alterado: `uv sync` usa a versão declarada e cria `.venv` na raiz. Node é necessário para desenvolver/compilar React e gerar/verificar os tipos HTTP, separado do runtime Python. Com nvm disponível, `nvm install` e `nvm use` na raiz selecionam a versão do frontend.

`pyproject.toml` declara as dependências de runtime FastAPI, Pydantic, Uvicorn, pandas, NumPy e SciPy. O grupo `pipeline` contém PyArrow, scikit-learn e threadpoolctl, usados offline. O grupo `dev` contém Ruff, pytest e HTTPX para os testes HTTP. Os dois grupos são ativados por padrão no uv para desenvolvimento. `nba_api` não é necessário para analisar o CSV já coletado, e PyOD não integra o ambiente.

`uv.lock` fixa também as dependências transitivas. `requirements.txt` exporta runtime + pipeline com versões e hashes, sem ferramentas dev. `requirements-runtime.txt` contém somente as dependências da API: o leitor usa JSON, e as descritivas filtradas usam pandas/NumPy/SciPy. A leitura e os cálculos foram verificados em ambiente isolado sem PyArrow/scikit-learn/threadpoolctl; [política e pacote de runtime](artifacts.md).

## Instalação e verificação

Pré-requisitos: Git, uv e, para os atalhos, GNU Make. Instalar uv pelas [instruções oficiais](https://docs.astral.sh/uv/getting-started/installation/). Executar da raiz do checkout:

```bash
make setup
make check
```

Equivalentes sem Make:

```bash
uv sync --locked
uv run --locked python -m backend.scripts.check_environment
uv run --locked ruff check backend
uv run --locked ruff format --check backend
uv run --locked pytest
```

A sincronização exige acesso aos pacotes e, se necessário, ao Python gerenciado pelo uv. Usar `--locked` evita atualizar o lock silenciosamente. Para modificar dependências intencionalmente, editar o pyproject, executar `uv lock`, sincronizar, testar e regenerar requirements. [Lock e sincronização do uv](https://docs.astral.sh/uv/concepts/projects/sync/).

Alternativa de instalação das dependências de execução e pipeline, com Python 3.12 já disponível:

```bash
python3.12 -m venv .venv
.venv/bin/python -m pip install --require-hashes -r requirements.txt
.venv/bin/python -m backend.scripts.check_environment
```

Essa alternativa não instala pytest/Ruff; usar o fluxo uv para desenvolvimento. O projeto é uma aplicação de repositório, sem pacote publicável nesta etapa (`tool.uv.package=false`); executar módulos com `python -m` a partir da raiz.

## Comandos e disponibilidade

| Comando | Estado e comportamento |
| --- | --- |
| `make help` | Lista os comandos e seus propósitos |
| `make setup` | Instala/sincroniza runtime, pipeline e desenvolvimento pelo lock |
| `make check-env` | Importa dependências, confere Python e localização dos dados; imprime versões e configuração |
| `make lint` | Ruff check + verificação de formatação |
| `make format` | Aplica somente a formatação Ruff |
| `make test` | Executa configuração, ciência e contratos/publicação dos artefatos |
| `make check` | Ambiente + lint + testes |
| `make export-requirements` | Regenera os dois requirements com hashes, sem atualizar o lock |
| `make data-normalize` | Gera base canônica, recorte e relatório intermediários da etapa 2 |
| `make data-quality` | Audita a fonte e libera dados enriquecidos somente se aprovados |
| `make data-describe` | Calcula descritivas, boxplots e distribuições após auditar a fonte |
| `make data-anomalies` | Executa sete métodos e verifica parâmetros/sensibilidade antes de gerar scores |
| `make data-build` | Executa todas as análises, valida e publica um release completo |
| `make data-validate` | Confere o release atual, hashes, schemas e consistências |
| `make data-reproduce` | Compara 13 artefatos de dois builds independentes, sem publicar |
| `make data-package-runtime` | Exporta manifesto e dez JSONs para a API |
| `make api-serve` | Inicia Uvicorn/FastAPI em 127.0.0.1:8000 |
| `make api-export` | Exporta OpenAPI sem exigir artefatos ou servidor |
| `make api-contracts` | Instala gerador pelo lock Node, gera e confere os tipos TypeScript |
| `make web-setup` | Instala frontend com npm ci e lock |
| `make dev` | Inicia API e Vite juntos; requer dependências e dados já preparados |
| `make web-check` | ESLint, Prettier, Vitest e build de produção |
| `make web-e2e` | Build e quatro testes de navegador com API real |
| `make deploy-prepare` | Monta pacote mínimo validado a partir do release e frontend/dist |

Os guias de [ingestão](ingestion.md) e [qualidade](quality.md) detalham os comandos e suas saídas locais. O [build científico completo](artifacts.md) está disponível desde a etapa 6. A [API](api.md) está disponível desde a etapa 7; iniciar com `make api-serve` depois de `make data-build` e consultar `/docs`. A [base React](frontend.md) está disponível; `make web-setup`, `make data-build` e `make dev` iniciam o sistema completo depois do setup Python.

## Configuração e organização do backend

```text
backend/
├── __init__.py
├── app/
│   ├── __init__.py
│   ├── config.py
│   ├── main.py                # factory, lifespan, rotas e erros
│   ├── queries.py             # allowlists e filtros
│   ├── schemas.py             # contratos HTTP
│   └── services.py            # composição usando o núcleo científico
├── analytics/                  # ingestão, qualidade, descritivas, detectores e sensibilidade
├── artifacts/                  # schemas, build, validação e pacote runtime
├── repositories/               # leitor readonly de releases
├── content/missingness.json    # teoria e limites dos métodos exigidos
├── scripts/
│   ├── check_environment.py
│   ├── normalize_data.py
│   ├── audit_data.py
│   ├── describe_data.py
│   ├── export_api.py
│   ├── build_data.py
│   ├── detect_anomalies.py
│   ├── export_sensitivity_review.py
│   └── generate_ecod_reference.py  # opcional: somente no uv isolado com PyOD
└── tests/
    ├── unit/test_config.py
    ├── analytics/              # contratos, qualidade, descritivas, distribuições e comando
    ├── fixtures/ecod-reference.json
    └── api/test_api.py         # contratos HTTP e equivalência científica
```

`backend/app/config.py` centraliza raiz do repositório, caminhos bruto/processado, nome e hash esperado do CSV, IDs dos times, métricas e versões iniciais de schema/análise. Os caminhos padrão derivam do arquivo de configuração, não do diretório corrente. Importar configuração não lê dados nem cria pastas. As versões identificam os contratos e relatórios; caminhos dos releases, ponteiro e pacote runtime também estão centralizados.

`data/raw/` é a entrada preservada; `data/processed/ingestion/` recebe os intermediários locais da etapa 2 e `data/processed/quality/` recebe diagnóstico e dados enriquecidos da etapa 3. Releases completos ficam em `data/processed/releases/`, com ponteiro `current.json`; o pacote exportado fica em `data/processed/runtime/`. Artefatos gerados continuam ignorados e são reconstruídos pelo pipeline. Não usar `git add -f` para publicar resultados parciais. CSV, PDF e documentos fornecidos continuam versionáveis e preservados.

## Testes

pytest está configurado no pyproject com marcadores estritos `unit`, `analytics` e `api`. As pastas separam configuração, cálculos e HTTP. Seleções disponíveis e futuras:

```bash
uv run --locked pytest backend/tests/unit
uv run --locked pytest -m analytics
uv run --locked pytest -m api
```

As seleções unit e analytics têm testes de configuração e de ingestão/qualidade, respectivamente. A suíte api tem 65 testes de contratos, filtros, referência, cache, concorrência e indisponibilidade. Os testes de configuração verificam caminhos; os de ingestão verificam contratos, conversões, preservação e roundtrip Parquet. Descritivas e distribuições são cobertas por exemplos manuais, propriedades, referências reais e casos de borda. Os detectores também são cobertos por referências externas, empates e sensibilidade; PyOD não é necessário nos testes normais.

## Validação da etapa 1 em 29/10/2026

| Verificação | Resultado |
| --- | --- |
| `make setup` | Ambiente criado com Python 3.12.13 e dependências fixadas |
| `make check` | Imports e caminhos válidos; Ruff/formatação aprovados; 2 testes aprovados |
| `uv pip check` | Dependências instaladas compatíveis |
| Instalação isolada do requirements | Ambiente temporário Python 3.12 com `uv pip sync --require-hashes`; verificação de imports e configuração aprovada, sem dependências dev |
| Preservação dos insumos | CSV e PDF comparados byte a byte com HEAD, sem alterações |
| Regras de ignore | Ambiente e artefatos ignorados; CSV/PDF e processed/.gitkeep preservados |
| `make data-build` | Erro explícito esperado; somente .gitkeep permanece em processed |

Node 24 foi registrado como versão-alvo, mas o frontend não foi instalado nem testado nesta etapa. A seleção não altera o Node global da máquina. Não houve prova de deploy.

R01, R05 e R06 permanecem parciais: preparar o ambiente não entrega aplicação, hospedagem nem submissão. O [histórico](../planning/requirements.md) registra as evidências de P1.01–P1.07.

## Validação da etapa 2 em 29/10/2026

`make check` aprovado com 34 testes (configuração e ingestão), Ruff e formatação. `make data-normalize` gerou base 2.238×28, 30 times e recorte 149×28. IDs, tipos, datas e valores foram preservados no roundtrip Parquet; execuções repetidas e entradas inválidas foram verificadas. Consulte [contratos e testes de ingestão](ingestion.md). O CSV original permanece inalterado.

## Validação da etapa 3 em 29/10/2026

`make check` aprovado com 67 testes, Ruff e formatação. `make data-quality` aprovado com 64 checagens sem falhas bloqueantes na base fornecida. Dados enriquecidos 2.238×33 e recorte 149×33; ausências, zeros, cobertura e aplicabilidade dos quatro métodos documentados. Os testes confirmam bloqueio e invalidação de saídas antigas após erros de entrada ou consistência. Consulte [qualidade e enriquecimento](quality.md).

## Validação da etapa 4 em 29/10/2026

`make check` aprovado com 110 testes, Ruff e formatação. `make data-describe` gera 14 resultados, quadros CV/IQR 7×2 e histogramas/KDE comparáveis. Medidas e dados dos boxplots compartilham os mesmos quartis. Foram reproduzidas as médias/CV, modas e outliers de referência; arquivos da fonte foram preservados. Ver [descritivas e distribuições](descriptive.md).

## Validação da etapa 5 em 29/10/2026

`make check` aprovado com 151 testes, Ruff e formatação. `make data-anomalies` gera 50 resultados e sensibilidade de 44 variantes, com parâmetros 1.0.0 revisados por snapshot. O ECOD coincide com seis fixtures de oráculo VCS fixado, a 1e−12. PyOD foi usado apenas em ambiente uv isolado para gerar fixtures e continua ausente da .venv, lock e requirements do projeto. [Reprodução, licença e limitações](anomalies.md).

## Validação da etapa 6 em 29/10/2026

`make check` aprovado com 171 testes, Ruff e formatação. Build integral, validação do release, reprodução independente dos 13 artefatos e exportação do pacote JSON aprovados. A instalação isolada de `requirements-runtime.txt` com hashes permite ler o pacote e calcular descritivas/distribuições de Atlanta/Houston em casa, sem CSV, Parquet, PyArrow, scikit-learn ou threadpoolctl. CSV/PDF preservados. [Contratos, publicação e reprodução](artifacts.md).

## Validação da etapa 7 em 29/10/2026

`make check` aprovado com 232 testes (61 HTTP), Ruff e formatação. As dez rotas foram verificadas também em Uvicorn real com `requirements-runtime.txt`, sem CSV/Parquet ou dependências offline. Tipos OpenAPI/TypeScript gerados por ferramentas com lock e compilação aprovada. Há um aviso de depreciação upstream do TestClient sobre HTTPX; os testes passam sem silenciá-lo. Nenhuma dependência Python foi alterada. Node 26.12.1 foi usado para validar o gerador; o alvo registrado do frontend continua Node 24. [Execução, contratos e limitações](api.md).

## Validação local da etapa 8 em 29/10/2026

236 testes Python, 24 Vitest e quatro Playwright aprovados, com lint/formatação e build. Instalação frontend pelo lock validada com Node 24.22.2. `make dev` e seu proxy `/api` foram verificados e encerrados com Ctrl+C, sem deixar servidores ativos. O pacote FastAPI + SPA foi verificado em ambiente de runtime sem dependências offline, com recargas profundas, API e assets. Há aviso Vite sobre o tamanho sem compressão do chunk ECharts, carregado sob demanda e medido; a depreciação upstream do TestClient permanece visível. A publicação e a medição Vercel não foram realizadas por falta de autenticação/escopo de destino. [Frontend](frontend.md) e [prova local/publicação](deployment.md).

## Publicação da etapa 8 em 29/10/2026

https://quadrascope.vercel.app foi publicada no projeto `quadrascope`, equipe `projetos-do-jorge`, no plano Hobby. Os quatro Playwright também passaram nessa URL, sem login, com os dez endpoints e códigos 404/422/304 conferidos. A Vercel classificou o primeiro deploy como produção apesar da solicitação de preview; é uma versão técnica, ainda sem o relatório completo. CLI 65.8.0 e plugin/MCP foram configurados no usuário. A consulta específica para separar cold start exige Observability Plus, sem upgrade realizado. [Detalhes e reprodução](deployment.md).
