# QuadraScope

Relatório web interativo de análise de dados da NBA, desenvolvido para o Projeto 1 de Laboratório de Ciência de Dados — UFAPE, 2026.2. O foco do grupo é **Atlanta Hawks × Houston Rockets**, nas variáveis PTS, REB, AST, STL, BLK, PF e FG3M.

**Estado atual:** etapas 0–5 concluídas. Ingestão, qualidade, descritivas e sete detectores com sensibilidade implementados no Python. Build/manifesto final, API, gráficos na interface, frontend e deploy ainda pendentes. A stack **FastAPI + React** foi confirmada pelo grupo.

## Estrutura atual

```text
QuadraScope/
├── README.md
├── pyproject.toml         # Dependências, Ruff e pytest
├── uv.lock                # Versões resolvidas
├── requirements.txt       # Runtime exportado com hashes
├── Makefile               # Comandos de desenvolvimento
├── backend/
│   ├── app/config.py      # Caminhos, times e versões
│   ├── analytics/
│   ├── repositories/
│   ├── content/
│   ├── scripts/
│   └── tests/             # unit, analytics e api
├── data/
│   ├── raw/stats_times_regular_final.csv
│   └── processed/         # Intermediários locais; ignorados pelo Git
└── docs/
    ├── README.md
    ├── development/
    │   ├── setup.md
    │   ├── ingestion.md
    │   ├── quality.md
    │   ├── descriptive.md
    │   └── anomalies.md
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

`data/raw/` guarda o CSV original sem alterações. `docs/data/` guarda sua documentação. O enunciado acadêmico fica em `docs/references/`; desenho do sistema, planejamento e dados têm pastas próprias. O frontend será adicionado na etapa 8.

## Ambiente e verificações

Usar **Python 3.12** e **uv**; GNU Make fornece os atalhos abaixo. O Node **24** está registrado em `.nvmrc` para o futuro frontend. Com uv instalado, executar da raiz:

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
- [Plano de implementação e tarefas](docs/planning/implementation-plan.md).
- [Requisitos, caixas de conclusão e histórico](docs/planning/requirements.md).
- [Arquitetura](docs/architecture/architecture.md) e [diagrama](docs/architecture/diagrams/quadrascope-arquitetura.svg).
- [Origem e extração dos dados](docs/data/provenance.md).

Para gerar a base canônica e o recorte do grupo:

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

Os JSONs ficam em `data/processed/descriptive/`, com metadados, estados por medida e tabelas 7×2. Os dados dos gráficos estão prontos; sua apresentação visual será implementada no React.

Para executar os sete detectores e a sensibilidade dos parâmetros:

```bash
make data-anomalies
```

Os relatórios ficam em `data/processed/anomalies/`, com referência fixa por time e parâmetros revisados para este snapshot. O ECOD próprio usa fixtures de referência; PyOD não integra o ambiente do projeto. Consulte o [relatório de sensibilidade versionado](docs/data/anomaly-sensitivity.json) e as limitações no guia dos detectores.

Ainda não há servidor de aplicação. `make data-build` continua reservado ao pipeline completo e retorna erro explícito; ele não substitui o comando de normalização. As instruções de execução da aplicação e hospedagem serão adicionadas nas etapas correspondentes.
