# Ambiente de desenvolvimento — etapa 1

## Versões e dependências

| Ferramenta | Versão do projeto | Registro |
| --- | --- | --- |
| Python | 3.12.x | `.python-version` e `requires-python` no pyproject |
| Node.js | 24.x, reservado para o frontend | `.nvmrc`; frontend começa na etapa 8 |
| uv | 0.11.7 usado na validação desta etapa | Gerencia `.venv`, `uv.lock` e exportação |
| GNU Make | 4.4.1 usado na validação | Atalhos no Makefile; comandos equivalentes abaixo |

Python 3.12 e Node 24 foram escolhidos entre as versões suportadas pela hospedagem prevista. Isso não equivale a uma prova de deploy; ela continua nas etapas 7–8. Referências consultadas em 29/10/2026: [Python na Vercel](https://vercel.com/docs/functions/runtimes/python), [Node na Vercel](https://vercel.com/docs/functions/runtimes/node-js/node-js-versions).

O Python global não precisa ser alterado: `uv sync` usa a versão declarada e cria `.venv` na raiz. O Node instalado na máquina não é usado nesta etapa. Com nvm disponível, `nvm install` e `nvm use` na raiz selecionam a versão do futuro frontend.

`pyproject.toml` declara dependências diretas: FastAPI, Pydantic, Uvicorn e ferramentas científicas pandas, NumPy, SciPy, scikit-learn e PyArrow. O grupo `dev` contém Ruff, pytest e HTTPX para os testes HTTP futuros. `nba_api` não é necessário para analisar o CSV já coletado, e PyOD não integra o ambiente.

`uv.lock` fixa também as dependências transitivas. `requirements.txt` é exportado do lock com versões e hashes, sem ferramentas de desenvolvimento. Nesta fase ele inclui as dependências científicas previstas para o pipeline; a redução do runtime de produção será decidida na etapa 6, não está validada pelo simples fechamento do lock.

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

Alternativa de instalação somente das dependências de execução, com Python 3.12 já disponível:

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
| `make setup` | Instala/sincroniza runtime e desenvolvimento pelo lock |
| `make check-env` | Importa dependências, confere Python e localização dos dados; imprime versões e configuração |
| `make lint` | Ruff check + verificação de formatação |
| `make format` | Aplica somente a formatação Ruff |
| `make test` | Executa os testes existentes; atualmente só configuração |
| `make check` | Ambiente + lint + testes |
| `make export-requirements` | Regenera requirements de runtime com hashes, sem atualizar o lock |
| `make data-build` | Reservado; termina com erro explícito e não gera artefatos |

Build de dados será implementado nas etapas 2–6; API e interface ainda não existem. Os comandos não simulam essas funcionalidades. Não há servidor para iniciar nem resultados estatísticos produzidos nesta etapa.

## Configuração e organização do backend

```text
backend/
├── __init__.py
├── app/
│   ├── __init__.py
│   └── config.py
├── analytics/                  # futuro núcleo científico
├── repositories/               # futuros repositórios de dados
├── content/                    # reservado para textos contextualizados
├── scripts/
│   └── check_environment.py
└── tests/
    ├── unit/test_config.py
    ├── analytics/              # reservado: cálculos futuros
    └── api/                    # reservado: contratos futuros
```

`backend/app/config.py` centraliza raiz do repositório, caminhos bruto/processado, nome do CSV, IDs dos times, métricas e versões iniciais de schema/análise. Os caminhos padrão derivam do arquivo de configuração, não do diretório corrente. Importar configuração não lê dados nem cria pastas. As versões iniciais serão usadas pelos artefatos futuros; não indicam que um schema de artefato já foi implementado.

`data/raw/` é a entrada preservada; `data/processed/` está reservada por `.gitkeep`. Artefatos gerados ficam ignorados até a política de publicação da etapa 6. Não usar `git add -f` para publicar resultados parciais. CSV, PDF e documentos fornecidos continuam versionáveis e preservados.

## Testes

pytest está configurado no pyproject com marcadores estritos `unit`, `analytics` e `api`. As pastas separam configuração, cálculos e HTTP. Exemplos de seleção para quando essas suítes existirem:

```bash
uv run --locked pytest backend/tests/unit
uv run --locked pytest -m analytics
uv run --locked pytest -m api
```

Nesta etapa apenas a primeira seleção tem testes. Seleções sem testes retornam o código de ausência de testes do pytest; não representam sucesso científico ou de API. Os testes de configuração verificam independência do diretório de execução e isolamento dos caminhos bruto/processado sem criação de arquivos.

## Validação realizada em 29/10/2026

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
