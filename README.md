# QuadraScope

Relatório web interativo de análise de dados da NBA, desenvolvido para o Projeto 1 de Laboratório de Ciência de Dados — UFAPE, 2026.2. O foco do grupo é **Atlanta Hawks × Houston Rockets**, nas variáveis PTS, REB, AST, STL, BLK, PF e FG3M.

**Estado atual:** relatório de Atlanta/Houston publicado em https://quadrascope.vercel.app, com as correções da etapa 10. P11.01–P11.09 concluídos: reprodução, CI e pacote preparados; P11.10 e a submissão no Classroom dependem do grupo. A stack **FastAPI + React** foi confirmada pelo grupo. [Relatório e limites](docs/development/report.md), [entrega e recuperação da hospedagem](docs/development/delivery.md).

**Etapa 10 publicada em 30/10/2026 (commit `83e8276`):** integração, ciência, conteúdo e acessibilidade revisados. 245 testes Python, 25 Vitest e 27 de navegador aprovados. Correções publicadas; submissão final ainda depende do grupo. [Evidências e limites](docs/development/validation.md).

**Preparação de entrega validada em 31/10/2026:** instalação isolada e ZIP sem `.git` comprovados; 245 testes Python, 25 Vitest, 27 Playwright locais e 27 públicos aprovados. Primeira CI remota aprovada no commit `162d33f`. O ZIP identifica o snapshot entregue pelo SHA-256. [Guia](docs/development/delivery.md), [evidências](docs/development/measurements/stage11-verification.json).

**Deploy automático:** após cadastrar o secret `VERCEL_SECRET_2` no GitHub, cada push na `main` publica na Vercel quando todas as verificações passam. A candidata é conferida antes da promoção para https://quadrascope.vercel.app. [Configuração e fluxo](docs/development/delivery.md#deploy-automático-da-main).

## Executar o sistema

Requisitos: **Python 3.12, uv, Node 24, Git e GNU Make**. Validado em Linux; Windows deve usar WSL2. A instalação inicial exige internet. Selecionar Node 24 antes de instalar (com nvm: `nvm install` e `nvm use`). Na raiz do projeto clonado ou do ZIP extraído:

```bash
make install
```

Depois da instalação, um único comando gera e valida os dados e inicia API + frontend:

```bash
make run
```

Abrir **http://127.0.0.1:5173**; API em **http://127.0.0.1:8000/docs**. `Ctrl+C` encerra ambos. As portas 8000/5173 precisam estar livres. A análise usa o CSV incluído: nenhuma chave NBA, serviço externo ou `.env` é necessário na execução local. uv gerencia o Python; npm gerencia o frontend. Não copiar `.venv` ou `node_modules` de outra máquina.

FastAPI mantém os cálculos científicos e contratos em Python; React organiza a navegação e visualiza as respostas. Os detectores usam a referência completa de cada time; filtros de data/mando/resultado não reajustam seus modelos. O snapshot é fixo, com 75 jogos de Atlanta e 74 de Houston, sem atualização automática da NBA. A origem da coleta foi informada pelo grupo e seus detalhes não fornecidos estão documentados. Não se afirma cobertura integral da temporada, causalidade ou desempenho preditivo dos detectores.

Para preparar o ZIP de código com hashes: `make delivery`. Para conferir ciência, API, artefatos e frontend: `make ci` em um checkout Git com dependências instaladas. [Instruções de entrega e Classroom](docs/development/delivery.md).

## Estrutura atual

```text
QuadraScope/
├── README.md
├── pyproject.toml         # Dependências, Ruff e pytest
├── uv.lock                # Versões resolvidas
├── requirements.txt       # Runtime + pipeline, com hashes
├── requirements-runtime.txt # Dependências da API, com hashes
├── Makefile               # Comandos de desenvolvimento
├── .github/workflows/ci.yml # Verificações automáticas
├── backend/
│   ├── app/               # FastAPI, configuração, contratos e serviços
│   ├── artifacts/          # Schemas, build, validação e exportação
│   ├── analytics/
│   ├── repositories/
│   ├── content/
│   ├── scripts/
│   └── tests/             # unit, analytics e api
├── data/
│   ├── raw/stats_times_regular_final.csv
│   └── processed/         # Releases e intermediários locais; ignorados pelo Git
├── frontend/              # React, Vite, testes e contrato HTTP gerado
├── deployment/            # Templates do pacote FastAPI + SPA
├── tools/contracts/       # Gerador de tipos com lock Node
└── docs/
    ├── README.md
    ├── development/
    │   ├── setup.md
    │   ├── ingestion.md
    │   ├── quality.md
    │   ├── descriptive.md
    │   ├── anomalies.md
    │   ├── artifacts.md
    │   ├── api.md
    │   ├── frontend.md
    │   ├── delivery.md      # Reprodução, recuperação e Classroom
    │   └── deployment.md
    ├── api/openapi.json    # Contrato HTTP exportado
    ├── architecture/
    │   ├── architecture.md
    │   └── diagrams/
    │       ├── architecture.dot
    │       └── quadrascope-arquitetura.svg
    ├── data/
    │   ├── provenance.md
    │   ├── data-dictionary.md
    │   ├── methodology.md
    │   └── anomaly-sensitivity.json
    ├── planning/
    │   ├── requirements.md
    │   └── implementation-plan.md
    └── references/
        └── Projeto 1.pdf
```

`data/raw/` guarda o CSV original sem alterações. `docs/data/` guarda sua documentação. O enunciado acadêmico fica em `docs/references/`; desenho do sistema, planejamento e dados têm pastas próprias. A base React está em `frontend/`; o pacote de publicação gerado fica em `.deployment/`, ignorado pelo Git.

## Ambiente e verificações

Usar **Python 3.12** e **uv**; GNU Make fornece os atalhos abaixo. O Node **24** está registrado em `.nvmrc` para o frontend. Com uv instalado, executar da raiz:

```bash
make setup
make check
```

`make setup` prepara `.venv` a partir do lock; `make check` confere dependências, lint, formatação e os testes existentes. A instalação usa Python gerenciado pelo uv quando necessário, sem alterar o Python global. Versão do uv usada na validação: 0.11.7.

O [guia de desenvolvimento](docs/development/setup.md) apresenta instalação alternativa por requirements, comandos sem Make, organização dos testes e atualização de dependências. A compatibilidade das versões com a hospedagem prevista está documentada nesse guia com referências oficiais.

## Por onde começar

- [Índice da documentação](docs/README.md).
- [Ambiente de desenvolvimento e comandos](docs/development/setup.md).
- [Ingestão, normalização e arquivos gerados](docs/development/ingestion.md).
- [Qualidade, cobertura e enriquecimento](docs/development/quality.md).
- [Descritivas, boxplots e distribuições](docs/development/descriptive.md).
- [Detectores, parâmetros e sensibilidade](docs/development/anomalies.md).
- [Build completo, manifesto e pacote de runtime](docs/development/artifacts.md).
- [API: execução, endpoints, filtros e contratos](docs/development/api.md).
- [Relatório web e mapa de requisitos](docs/development/report.md).
- [Frontend: executar e verificar](docs/development/frontend.md).
- [Pacote, medições e publicação na Vercel](docs/development/deployment.md).
- [Plano de implementação e tarefas](docs/planning/implementation-plan.md).
- [Requisitos, caixas de conclusão e histórico](docs/planning/requirements.md).
- [Arquitetura](docs/architecture/architecture.md) e [diagrama](docs/architecture/diagrams/quadrascope-arquitetura.svg).
- [Origem e extração dos dados](docs/data/provenance.md).

Para gerar e validar o conjunto completo de artefatos:

```bash
make data-build
make data-validate
make data-reproduce
make data-package-runtime
```

O release completo fica em `data/processed/releases/`, identificado pelo manifesto e por `current.json`. O pacote da API fica em `data/processed/runtime/`, com dez JSONs e manifesto, dispensando CSV e Parquet. [Contratos, publicação e reprodução](docs/development/artifacts.md).

Os comandos abaixo continuam disponíveis para diagnóstico intermediário. Para gerar a base canônica e o recorte do grupo:

```bash
make data-normalize
```

Os intermediários ficam em `data/processed/ingestion/`: `canonical.parquet`, `focus.parquet` e `ingestion.json`. O comando confere o hash do CSV e preserva os dados originais. Para executar a auditoria de qualidade e gerar os intermediários enriquecidos:

```bash
make data-quality
```

O relatório fica em `data/processed/quality/quality.json`. Somente uma base aprovada nas regras internas gera `canonical_enriched.parquet` e `focus_enriched.parquet`, preservando os 28 campos e adicionando adversário, pontos adversários, saldo, mando e prorrogações. Falhas bloqueiam as saídas enriquecidas; zeros legítimos e prorrogações são preservados como contexto.

Para calcular as medidas das sete variáveis, boxplots, histogramas/KDE e quadros comparativos:

```bash
make data-describe
```

Os JSONs ficam em `data/processed/descriptive/`, com metadados, estados por medida e tabelas 7×2. O React apresenta os gráficos e suas alternativas tabulares.

Para executar os sete detectores e a sensibilidade dos parâmetros:

```bash
make data-anomalies
```

Os relatórios ficam em `data/processed/anomalies/`, com referência fixa por time e parâmetros revisados para este snapshot. O ECOD próprio usa fixtures de referência; PyOD não integra o ambiente do projeto. Consulte o [relatório de sensibilidade versionado](docs/data/anomaly-sensitivity.json) e as limitações no guia dos detectores.

Para iniciar a API depois do build:

```bash
make api-serve
```

Abra `http://127.0.0.1:8000/docs` para consultar os endpoints ou `http://127.0.0.1:8000/api/v1/health` para verificar os artefatos. A API aplica filtros inclusivos de data, mando e resultado; descritivas são recalculadas e detectores mantêm a referência completa do time. Se faltar um pacote válido, as rotas de dados retornam 503. [Comandos, exemplos e tratamento dos estados](docs/development/api.md).

Para iniciar o sistema local completo, usando Node 24, Python 3.12 e uv:

```bash
make install
make run
```

Abra **http://127.0.0.1:5173**. O último comando gera os artefatos e inicia API e frontend juntos; Ctrl+C encerra ambos. A instalação inicial é separada da execução. `make dev` usa os artefatos existentes e continua disponível para desenvolvimento.

`make web-check` verifica frontend e build; `make check` verifica Python. `make api-contracts` exporta OpenAPI, gera os tipos TypeScript e verifica sua compilação. Para montar o pacote FastAPI + SPA, executar `make web-build` e `make deploy-prepare` após o build dos dados. A topologia foi verificada localmente e na Vercel, com dependências reais. **Versão técnica pública: https://quadrascope.vercel.app**, na equipe `projetos-do-jorge`, plano Hobby. Na publicação da etapa 10, commit `83e8276`, passaram 27 testes de navegador e 19 verificações HTTP, cobrindo seis páginas e os dez endpoints. [Deploy, métricas e limites](docs/development/deployment.md).
