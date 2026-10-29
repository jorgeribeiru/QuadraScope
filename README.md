# QuadraScope

Relatório web interativo de análise de dados da NBA, desenvolvido para o Projeto 1 de Laboratório de Ciência de Dados — UFAPE, 2026.2. O foco do grupo é **Atlanta Hawks × Houston Rockets**, nas variáveis PTS, REB, AST, STL, BLK, PF e FG3M.

**Estado atual:** etapas 0 e 1 concluídas. Estrutura Python, ambiente reproduzível, configuração e testes iniciais disponíveis. Pipeline científico, API, frontend e deploy ainda não implementados. A stack **FastAPI + React** foi confirmada pelo grupo.

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
│   └── processed/         # Reservado para artefatos futuros
└── docs/
    ├── README.md
    ├── development/
    │   └── setup.md
    ├── architecture/
    │   ├── architecture.md
    │   └── diagrams/
    │       ├── architecture.dot
    │       └── quadrascope-arquitetura.svg
    ├── data/
    │   ├── provenance.md
    │   ├── data-dictionary.md
    │   └── methodology.md
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
- [Plano de implementação e tarefas](docs/planning/implementation-plan.md).
- [Requisitos, caixas de conclusão e histórico](docs/planning/requirements.md).
- [Arquitetura](docs/architecture/architecture.md) e [diagrama](docs/architecture/diagrams/quadrascope-arquitetura.svg).
- [Origem e extração dos dados](docs/data/provenance.md).

Não há servidor de aplicação nesta fase. `make data-build` termina com erro explícito porque o pipeline pertence às etapas 2–6; nenhum artefato é gerado. As instruções de execução da aplicação e hospedagem serão adicionadas quando essas etapas estiverem implementadas e verificadas.
