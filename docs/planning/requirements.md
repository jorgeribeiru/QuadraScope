# Requisitos e acompanhamento — QuadraScope

> Base: [Projeto 1.pdf](<../references/Projeto 1.pdf>), cinco páginas. Revisão: 29/10/2026. Os critérios abaixo são planejados; nenhuma funcionalidade de aplicação está concluída.

A ordem de trabalho e as tarefas detalhadas estão no [plano de implementação](implementation-plan.md). Este arquivo acompanha o cumprimento dos requisitos do enunciado.

## Matriz de rastreabilidade

| Concluído | ID | Exigência / página do PDF | Entrega no sistema | Critério de aceite | Evidência / data |
| --- | --- | --- | --- | --- | --- |
| [ ] | R01 | Sistema Python com justificativa do framework, p.1 | API FastAPI e análise Python; justificativa em Dados | Justificativa acessível e composição com React enquadrada antes de consolidar a UI | Parcial — 29/10/2026: stack confirmada pelo grupo e [justificada](../architecture/architecture.md); falta aplicação e apresentação no sistema |
| [ ] | R02 | Relatório com resultados e interpretação, p.1 | Todas as seções e Síntese | Tabelas/gráficos acompanhados de texto crítico com evidências | — |
| [ ] | R03 | Navegação e seleção de time/variável, p.1 | Perfil e Comparação | Trocar time/variável atualiza resultados, n e contexto sem conclusões desatualizadas | — |
| [ ] | R04 | Títulos, eixos, unidades, legendas e tabelas padronizadas, p.1 | Componentes de gráfico e tabela | Convenções uniformes e alternativa tabular acessível | — |
| [ ] | R05 | Hospedagem ou instruções locais, p.1 | URL pública e README | Abrir URL em sessão limpa; alternativa local com requirements.txt e comando único documentado | — |
| [ ] | R06 | Código e link de aplicação, p.2 | Repositório/zip e submissão | Entrega reproduzível identificando versão; submissão é responsabilidade do grupo | — |
| [ ] | R07 | Dimensões, colunas e significado, p.2 | Dados e dicionário | Todas as 28 colunas, unidade de análise e cobertura | — |
| [ ] | R08 | Tipos, data e tamanho, p.2 | Dados e transformações | Tipos semânticos, parsing de datas, bytes e contagens identificados | — |
| [ ] | R09 | Nomes intuitivos e conversões, p.2 | Mapa original→canônico | Mostrar todas as renomeações e explicar que W/L já são numéricos neste CSV | — |
| [ ] | R10 | Excluir campos sem função para modelos, p.2 | Metodologia de seleção | Justificar vetor de sete variáveis, preservar base e discutir vazamento futuro | — |
| [ ] | R11 | Zeros, negativos, duplicatas e fora de domínio, p.2 | Qualidade | Contagens e regras verificáveis por coluna; consistências entre linhas separadas | — |
| [ ] | R12 | Missing por coluna e MCAR/MAR/MNAR, p.2 | Qualidade e métodos | Contagens reais e distinção entre células ausentes e cobertura incompleta | — |
| [ ] | R13 | Little, Jamshidian–Jalal, Listing–Schlittgen, Fairclough, p.2 | Dados e métodos | Explicar teoria, pressupostos, uso e inaplicabilidade atual; nenhuma execução fictícia | — |
| [ ] | R14 | Inconsistências/outliers por coluna, p.3 | Qualidade e Anomalias | Tabela com domínio do método, contagens e não aplicabilidade para IDs/textos | — |
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

Nenhuma atividade de implementação concluída até esta revisão. A documentação preparatória e as confirmações do grupo estão assinaladas na etapa 0 do plano; elas não concluem os requisitos de apresentação no sistema.

## Pendências e responsabilidade

| Pendência | Responsável / momento de resolução |
| --- | --- |
| Parâmetros finais e sensibilidade dos detectores | Implementação científica; antes de publicar scores |
| Revisão fixa do oráculo ECOD e tolerâncias | Implementação científica; antes das fixtures |
| Topologia Vercel e requisitos de execução | Implementação/infra; na prova de hospedagem |

Origem e stack foram confirmadas pelo grupo e registradas no histórico. Data exata da extração, endpoints, versão da biblioteca e tratamentos prévios permanecem não informados, conforme a [proveniência](../data/provenance.md); isso não reabre P0.06, que admite o registro explícito das limitações.

Essas pendências técnicas não exigem suspender a preparação local. O status de cada requisito será atualizado por evidência na implementação, não apenas pela existência deste documento.
