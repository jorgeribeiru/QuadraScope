# Requisitos e acompanhamento — QuadraScope

> Base: [Projeto 1.pdf](<../references/Projeto 1.pdf>), cinco páginas. Revisão: 29/10/2026. Etapas 0–3 concluídas; infraestrutura, normalização e auditoria interna validadas. Os requisitos da aplicação permanecem pendentes ou parciais.

A ordem de trabalho e as tarefas detalhadas estão no [plano de implementação](implementation-plan.md). Este arquivo acompanha o cumprimento dos requisitos do enunciado.

## Matriz de rastreabilidade

| Concluído | ID | Exigência / página do PDF | Entrega no sistema | Critério de aceite | Evidência / data |
| --- | --- | --- | --- | --- | --- |
| [ ] | R01 | Sistema Python com justificativa do framework, p.1 | API FastAPI e análise Python; justificativa em Dados | Justificativa acessível e composição com React enquadrada antes de consolidar a UI | Parcial — 29/10/2026: stack confirmada e [ambiente Python validado](../development/setup.md); faltam API e apresentação da justificativa no sistema |
| [ ] | R02 | Relatório com resultados e interpretação, p.1 | Todas as seções e Síntese | Tabelas/gráficos acompanhados de texto crítico com evidências | — |
| [ ] | R03 | Navegação e seleção de time/variável, p.1 | Perfil e Comparação | Trocar time/variável atualiza resultados, n e contexto sem conclusões desatualizadas | — |
| [ ] | R04 | Títulos, eixos, unidades, legendas e tabelas padronizadas, p.1 | Componentes de gráfico e tabela | Convenções uniformes e alternativa tabular acessível | — |
| [ ] | R05 | Hospedagem ou instruções locais, p.1 | URL pública e README | Abrir URL em sessão limpa; alternativa local com requirements.txt e comando único documentado | Parcial — 29/10/2026: requirements com hashes, setup e verificações [documentados](../development/setup.md); aplicação e deploy ainda inexistentes |
| [ ] | R06 | Código e link de aplicação, p.2 | Repositório/zip e submissão | Entrega reproduzível identificando versão; submissão é responsabilidade do grupo | — |
| [ ] | R07 | Dimensões, colunas e significado, p.2 | Dados e dicionário | Todas as 28 colunas, unidade de análise e cobertura | Parcial — 29/10/2026: [registro das 28 colunas e cobertura](../development/ingestion.md) implementados; falta apresentação no sistema |
| [ ] | R08 | Tipos, data e tamanho, p.2 | Dados e transformações | Tipos semânticos, parsing de datas, bytes e contagens identificados | Parcial — 29/10/2026: tipos, datas, tamanho e [cobertura auditada](../development/quality.md) disponíveis; falta apresentação no sistema |
| [ ] | R09 | Nomes intuitivos e conversões, p.2 | Mapa original→canônico | Mostrar todas as renomeações e explicar que W/L já são numéricos neste CSV | Parcial — 29/10/2026: [mapa e conversões](../../backend/analytics/metrics.py) implementados e testados; falta apresentação no sistema |
| [ ] | R10 | Excluir campos sem função para modelos, p.2 | Metodologia de seleção | Justificar vetor de sete variáveis, preservar base e discutir vazamento futuro | Parcial — 29/10/2026: vetor das sete variáveis e motivos de exclusão no [registro](../../backend/analytics/metrics.py); falta discussão publicada no sistema |
| [ ] | R11 | Zeros, negativos, duplicatas e fora de domínio, p.2 | Qualidade | Contagens e regras verificáveis por coluna; consistências entre linhas separadas | Parcial — 29/10/2026: [domínios, zeros, duplicatas e relações](../../backend/analytics/quality.py) auditados; falta apresentação no sistema |
| [ ] | R12 | Missing por coluna e MCAR/MAR/MNAR, p.2 | Qualidade e métodos | Contagens reais e distinção entre células ausentes e cobertura incompleta | Parcial — 29/10/2026: zero missing por coluna, cobertura separada e [mecanismos explicados](../../backend/content/missingness.json); falta apresentação no sistema |
| [ ] | R13 | Little, Jamshidian–Jalal, Listing–Schlittgen, Fairclough, p.2 | Dados e métodos | Explicar teoria, pressupostos, uso e inaplicabilidade atual; nenhuma execução fictícia | Parcial — 29/10/2026: [teoria e aplicabilidade](../../backend/analytics/missingness.py) dos quatro métodos implementadas; sem execução fictícia; falta apresentação no sistema |
| [ ] | R14 | Inconsistências/outliers por coluna, p.3 | Qualidade e Anomalias | Tabela com domínio do método, contagens e não aplicabilidade para IDs/textos | Parcial — 29/10/2026: [inconsistências e domínios](../development/quality.md) disponíveis; outliers ainda não avaliados e apresentação no sistema pendente |
| [ ] | R15 | Z-score/IQR, Grubbs, ECOD, k-NN, DBSCAN, LOF, p.3 | Anomalias e metodologia | Implementação validada, parâmetros, referência, quantidades e registros; distinguir uni/multivariado | — |
| [ ] | R16 | Medidas das sete variáveis por time, p.3 | Perfil | Média, mediana, moda(s), extremos, amplitude, desvio, variância, Q1/Q3 e outliers para ambos | — |
| [ ] | R17 | Boxplot com todos os elementos, p.3 | Perfil e Comparação | Média, mediana, moda(s), Q1/Q3, cercas, bigodes e outliers consistentes com tabela | — |
| [ ] | R18 | Barras comparativas e papel do z-score, p.3 | Comparação | Mesma unidade, eixo comum, referência explícita para padronização | — |
| [ ] | R19 | Assimetria e fórmula, p.3–4 | Perfil e Comparação | Coeficiente, direção, intensidade, critério, histograma/KDE, boxplot e discussão | — |
| [ ] | R20 | CV: cálculo, validade e quadro, p.4–5 | Comparação | Quadro 7×2, fórmula amostral/%, média positiva, discussão de BLK/STL e escala | — |
| [ ] | R21 | CV com desvio/assimetria e alternativa robusta, p.4–5 | Comparação e Síntese | Regularidade por variável, discordâncias explicadas, sem rótulo global indevido | — |
| [ ] | R22 | IQR, Q1/Q3, método e quadro, p.5 | Comparação | Tabela Q1/Q3/IQR e quadro 7×2 com quartis iguais aos boxplots | — |
| [ ] | R23 | IQR versus amplitude/desvio e regra de outliers, p.5 | Comparação e Anomalias | Cercas corretas, registros coincidentes e discussão de extremos; não forçar evidência inexistente | — |
| [ ] | R24 | Síntese interpretativa, p.1 e desenvolvimento | Página inicial | Conclusões sobre os dois times ligadas a evidências e limitações | — |

Os nomes de métodos no enunciado têm variações de grafia; a documentação usa Jamshidian–Jalal e Listing–Schlittgen, preservando a correspondência com o PDF. O PDF exige discussão dos testes de missingness e implementação/explicação dos métodos de outlier; a matriz distingue essas obrigações.

## Como registrar o progresso

- `[ ]`: requisito pendente ou parcialmente atendido.
- `[X]`: requisito integralmente atendido e validado conforme o critério de aceite.
- Ao concluir uma tarefa, marcar sua caixa no plano e registrar abaixo os requisitos afetados. Na matriz, marcar `[X]` somente quando todas as partes do requisito estiverem atendidas.
- Preencher “Evidência / data” com a data e o link do arquivo, teste, resultado, commit ou URL que permite verificar a conclusão. Texto de planejamento sozinho não comprova funcionalidade pronta.
- Trabalho parcial deve ser registrado no histórico, mantendo o requisito desmarcado. Se uma mudança invalidar a evidência, reabrir o requisito com `[ ]` e registrar o motivo.
- As caixas dentro da tabela são marcadores textuais Markdown; a atualização é feita no arquivo, não depende de um checkbox interativo do visualizador.

Exemplo de registro futuro: ao concluir uma tarefa de ingestão, registrar seus IDs de tarefa e requisitos relacionados; R08 só será marcado quando tipos, datas e tamanho também estiverem apresentados e validados no sistema.

## Histórico de atividades e validações

Registrar uma linha a cada atividade concluída, mesmo quando o requisito ainda estiver parcial. Usar o ID estável da tarefa no plano, para ligar execução, requisito e evidência. Não apagar registros anteriores ao reabrir um requisito.

| Data | Tarefa(s) do plano | Requisito(s) | Atividade / resultado da validação | Evidência | Responsável |
| --- | --- | --- | --- | --- | --- |
| 29/10/2026 | P0.06 | R07, R08 — preparação | Grupo confirmou origem NBA 2025–26, API oficial via nba_api; detalhes não fornecidos registrados como limitação | [Proveniência](../data/provenance.md), declaração do grupo nesta revisão | Grupo; registro: Codex |
| 29/10/2026 | P0.07 | R01 — parcial | Grupo confirmou validação externa de FastAPI + React; justificativa registrada | [Arquitetura](../architecture/architecture.md), confirmação do grupo nesta revisão | Grupo; registro: Codex |
| 29/10/2026 | P1.01 | R01, R05, R06 — infraestrutura | Estrutura Python e pastas de conteúdo/testes criadas; data/raw reutilizado e processed reservado | [Organização do backend](../development/setup.md), [configuração](../../backend/app/config.py) | Codex |
| 29/10/2026 | P1.02 | R05 — parcial | Python 3.12 e Node 24 registrados; Python 3.12.13 usado na validação; Node reservado à etapa 8 | [.python-version](../../.python-version), [.nvmrc](../../.nvmrc), [justificativa](../development/setup.md) | Codex |
| 29/10/2026 | P1.03 | R01, R05, R06 — infraestrutura | make setup aprovado; dependências compatíveis; requirements instalado em ambiente isolado com validação dos hashes | [pyproject](../../pyproject.toml), [lock](../../uv.lock), [requirements](../../requirements.txt), [validação](../development/setup.md) | Codex |
| 29/10/2026 | P1.04 | R01, R06 — infraestrutura | Ruff e formatação aprovados; pytest com 2 testes de configuração aprovados e marcadores estritos unit/analytics/api | [Configuração das ferramentas](../../pyproject.toml), [testes](../../backend/tests/unit/test_config.py) | Codex |
| 29/10/2026 | P1.05 | R06 — infraestrutura | Ignore validado para ambientes/caches/builds; CSV e PDF conferidos byte a byte contra HEAD, sem alterações | [.gitignore](../../.gitignore), [validação](../development/setup.md) | Codex |
| 29/10/2026 | P1.06 | R01, R06 — infraestrutura | Caminhos, times, métricas e versões centralizados; testes de independência do diretório corrente e isolamento aprovados | [Settings](../../backend/app/config.py), [testes](../../backend/tests/unit/test_config.py) | Codex |
| 29/10/2026 | P1.07 | R05, R06 — infraestrutura | make check aprovado; comandos documentados; data-build falha explicitamente sem criar artefatos | [Makefile](../../Makefile), [guia](../development/setup.md) | Codex |
| 29/10/2026 | P2.01 | R08 — parcial | Snapshot único com SHA-256, bytes, codificação e dimensões; digest conferido contra proveniência | [Ingestão](../../backend/analytics/ingestion.py), [configuração](../../backend/app/config.py) | Codex |
| 29/10/2026 | P2.02 | R07, R08 — parciais | Leitor estrito valida schema e registros; IDs textuais preservam zeros à esquerda | [Testes de ingestão](../../backend/tests/analytics/test_ingestion.py) | Codex |
| 29/10/2026 | P2.03 | R08, R09 — parciais | Conversões e mapa de 28 colunas; WL validado antes do booleano e campos anuláveis sem imputação | [Registro](../../backend/analytics/metrics.py), [ingestão](../../backend/analytics/ingestion.py) | Codex |
| 29/10/2026 | P2.04 | R08, R09 — parciais | Data civil date32 sem fuso, parsing estrito e ordenação por time/data/partida; roundtrip Parquet aprovado | [Testes](../../backend/tests/analytics/test_ingestion.py) | Codex |
| 29/10/2026 | P2.05 | R07, R09, R10 — parciais | Registro imutável de nomes, tipos, rótulos, unidades, domínios e elegibilidade | [Métricas](../../backend/analytics/metrics.py) | Codex |
| 29/10/2026 | P2.06 | R07, R08 — parciais | make data-normalize gerou base intermediária 2.238×28 com 30 times; sem descartar campos ou linhas | [Comando](../../backend/scripts/normalize_data.py), [guia](../development/ingestion.md) | Codex |
| 29/10/2026 | P2.07 | R10 — parcial | Recorte 149×28, com 75/74 jogos; features 149×7 em ordem fixa e exclusões justificadas | [Seleções](../../backend/analytics/ingestion.py), [registro](../../backend/analytics/metrics.py) | Codex |
| 29/10/2026 | P2.08 | R07–R10 — parciais | make check aprovado: 34 testes, Ruff e formatação; entradas inválidas, preservação, repetição e Parquet validados | [Testes](../../backend/tests/analytics/test_ingestion.py), [validação](../development/ingestion.md) | Codex |
| 29/10/2026 | P3.01 | R11, R12, R14 — parciais | Perfis das 28 colunas, global/grupo: missing, zeros, negativos, domínio e não aplicabilidade; outliers não avaliados | [Auditoria](../../backend/analytics/quality.py) | Codex |
| 29/10/2026 | P3.02 | R11 — parcial | Duplicatas, chave, nomes e siglas auditados; zero excessos na base real | [Auditoria](../../backend/analytics/quality.py), [testes](../../backend/tests/analytics/test_quality.py) | Codex |
| 29/10/2026 | P3.03 | R11 — parcial | Identidades, arremessos e percentuais conferidos; denominador zero gera aviso sem divisão/imputação | [Regras e tolerâncias](../development/quality.md) | Codex |
| 29/10/2026 | P3.04 | R11 — parcial | Pareamento 1:1 por partida/lado antes do recorte; data, times, resultado, placar, mando e minutos conferidos | [Auditoria](../../backend/analytics/quality.py), [testes](../../backend/tests/analytics/test_quality.py) | Codex |
| 29/10/2026 | P3.05 | R08 — parcial | Cinco campos derivados preservando os 28 originais; base enriquecida 2.238×33 e recorte 149×33 | [Dicionário](../data/data-dictionary.md), [comando](../../backend/scripts/audit_data.py) | Codex |
| 29/10/2026 | P3.06 | R08, R12 — parciais | W/L/W_PCT e sequência conferidos; lacunas de cobertura diferenciadas de células ausentes | [Acumulados](../../backend/analytics/quality.py) | Codex |
| 29/10/2026 | P3.07 | R08 — parcial | 1.119 partidas; grupo 149 registros/147 partidas; 75/74 jogos e dois confrontos diretos, com mando/vitórias/prorrogações | [Cobertura](../development/quality.md) | Codex |
| 29/10/2026 | P3.08 | R12, R13 — parciais | Teoria, pressupostos e aplicabilidade dos quatro métodos; zero missing, sem estatísticas ou p-valores inventados | [Conteúdo](../../backend/content/missingness.json), [estados](../../backend/analytics/missingness.py) | Codex |
| 29/10/2026 | P3.09 | R11–R14 — parciais | make check aprovado com 67 testes; erros de domínio/data, duplicatas, ausência de adversário, resultado e denominador zero cobertos | [Testes de qualidade](../../backend/tests/analytics/test_quality.py) | Codex |
| 29/10/2026 | P3.10 | R11–R14 — parciais | 64 checagens, sem bloqueios na base real; falhas geram diagnóstico e invalidam enriquecidos antigos, preservando CSV/PDF | [Auditoria executável](../../backend/scripts/audit_data.py), [guia](../development/quality.md) | Codex |

Etapas 1–3 de implementação concluídas e validadas em 29/10/2026. Infraestrutura, normalização e auditoria estão assinaladas no plano; elas não concluem os requisitos de apresentação no sistema, detecção estatística de outliers, hospedagem ou submissão.

## Pendências e responsabilidade

| Pendência | Responsável / momento de resolução |
| --- | --- |
| Parâmetros finais e sensibilidade dos detectores | Implementação científica; antes de publicar scores |
| Revisão fixa do oráculo ECOD e tolerâncias | Implementação científica; antes das fixtures |
| Topologia Vercel e requisitos de execução | Implementação/infra; na prova de hospedagem |

Origem e stack foram confirmadas pelo grupo e registradas no histórico. Data exata da extração, endpoints, versão da biblioteca e tratamentos prévios permanecem não informados, conforme a [proveniência](../data/provenance.md); isso não reabre P0.06, que admite o registro explícito das limitações.

Essas pendências técnicas não exigem suspender a preparação local. O status de cada requisito será atualizado por evidência na implementação, não apenas pela existência deste documento.
