# QuadraScope

Relatório web interativo de análise de dados da NBA, desenvolvido para o Projeto 1 de Laboratório de Ciência de Dados — UFAPE, 2026.2. O foco do grupo é **Atlanta Hawks × Houston Rockets**, nas variáveis PTS, REB, AST, STL, BLK, PF e FG3M.

**Estado atual:** planejamento e documentação. A aplicação e o pipeline ainda não foram implementados. A stack **FastAPI + React** foi confirmada pelo grupo.

## Estrutura atual

```text
QuadraScope/
├── README.md
├── data/
│   └── raw/
│       └── stats_times_regular_final.csv
└── docs/
    ├── README.md
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

`data/raw/` guarda o CSV original sem alterações. `docs/data/` guarda sua documentação. O enunciado acadêmico fica em `docs/references/`; desenho do sistema, planejamento e dados têm pastas próprias. Backend e frontend serão adicionados durante a implementação.

## Por onde começar

- [Índice da documentação](docs/README.md).
- [Plano de implementação e tarefas](docs/planning/implementation-plan.md).
- [Requisitos, caixas de conclusão e histórico](docs/planning/requirements.md).
- [Arquitetura](docs/architecture/architecture.md) e [diagrama](docs/architecture/diagrams/quadrascope-arquitetura.svg).
- [Origem e extração dos dados](docs/data/provenance.md).

Não há comando de execução da aplicação nesta fase. As instruções de instalação, execução local e hospedagem serão adicionadas quando essas etapas estiverem implementadas e verificadas.
