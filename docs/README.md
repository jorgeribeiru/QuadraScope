# Documentação do QuadraScope

| Área | Documento | Finalidade |
| --- | --- | --- |
| Referências | [Enunciado do Projeto 1](<references/Projeto 1.pdf>) | Fonte dos requisitos acadêmicos |
| Desenvolvimento | [Ambiente e comandos](development/setup.md) | Instalação, versões, ferramentas e validações da etapa 1 |
| Desenvolvimento | [Ingestão e normalização](development/ingestion.md) | Comando, contratos e intermediários da etapa 2 |
| Desenvolvimento | [Qualidade e enriquecimento](development/quality.md) | Regras, bloqueios, cobertura e missingness da etapa 3 |
| Desenvolvimento | [Descritivas e distribuições](development/descriptive.md) | Medidas, boxplots, histogramas/KDE e quadros da etapa 4 |
| Desenvolvimento | [Detectores e sensibilidade](development/anomalies.md) | Sete métodos, parâmetros revisados e validação ECOD da etapa 5 |
| Desenvolvimento | [Artefatos reproduzíveis](development/artifacts.md) | Build completo, schemas, manifesto, publicação e pacote de runtime da etapa 6 |
| Desenvolvimento | [API FastAPI](development/api.md) | Servidor local, filtros, referência científica, erros e cache da etapa 7 |
| Desenvolvimento | [Frontend React](development/frontend.md) | Execução completa, URL/filtros, cache, componentes e testes da base React |
| Desenvolvimento | [Guia, navegação e consultas](development/frontend-review.md) | Melhorias de frontend, links diretos e validação com API existente, sem regenerar dados |
| Desenvolvimento | [Pacote e hospedagem](development/deployment.md) | Topologia, publicação Vercel, verificações reais e limitação das métricas Hobby |
| Desenvolvimento | [Relatório web](development/report.md) | Páginas da etapa 9, interpretação contextual, gráficos, métodos e mapa dos requisitos |
| Desenvolvimento | [Validação do relatório](development/validation.md) | Revisão da etapa 10, correções, auditoria CSV, acessibilidade e matriz R01–R24 |
| Entrega | [Reprodução, CI e Classroom](development/delivery.md) | Instalação limpa, comando único, ZIP com hashes e recuperação da hospedagem |
| API | [OpenAPI exportado](api/openapi.json) | Contratos HTTP usados para gerar os tipos TypeScript |
| Planejamento | [Requisitos e acompanhamento](planning/requirements.md) | Matriz R01–R24, critérios de aceite e histórico |
| Planejamento | [Plano de implementação](planning/implementation-plan.md) | Tarefas P0–P11, dependências e verificações |
| Planejamento | [Plano de organização e consulta](planning/frontend-review-plan.md) | Escopo e critérios das melhorias de navegação e leitura |
| Arquitetura | [Desenho do sistema](architecture/architecture.md) | Escopo, stack, componentes, API e deploy |
| Arquitetura | [Diagrama SVG](architecture/diagrams/quadrascope-arquitetura.svg) | Visualização do fluxo e das responsabilidades |
| Arquitetura | [Fonte DOT](architecture/diagrams/architecture.dot) | Arquivo editável que gera o SVG |
| Dados | [Proveniência](data/provenance.md) | Origem declarada, extração, identificação e limitações |
| Dados | [Dicionário](data/data-dictionary.md) | As 28 colunas, tipos e transformações |
| Dados | [Metodologia](data/methodology.md) | Fórmulas, pressupostos e validação científica |
| Dados | [Sensibilidade versionada](data/anomaly-sensitivity.json) | Revisão 1.0.0 das 44 variantes no snapshot do projeto |

O [CSV original](../data/raw/stats_times_regular_final.csv) fica fora da documentação, em `data/raw/`. O backend inclui ciência, build reproduzível e API FastAPI. O relatório web completo e as correções da revisão da etapa 10 estão publicados na Vercel; a inicialização da aplicação foi medida em workers reais, com limites documentados para o provisionamento da plataforma. Voltar ao [README do projeto](../README.md).
