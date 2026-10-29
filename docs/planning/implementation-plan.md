# Plano de implementação — QuadraScope

> Do passo 0 à entrega. Revisão: 29/10/2026. Foco: Atlanta Hawks × Houston Rockets.
> Estado atual: etapas 0 e 1 concluídas. Ambiente Python, estrutura, configuração e testes iniciais disponíveis; ingestão, análise, API, frontend e deploy ainda não implementados.

## Uso do plano

Este arquivo define **como executar o trabalho**. A [matriz de requisitos](requirements.md) define **o que precisa ser atendido** e mantém o histórico das atividades e suas evidências. A [arquitetura](../architecture/architecture.md), a [metodologia](../data/methodology.md) e o [dicionário](../data/data-dictionary.md) são as referências para as decisões técnicas.

Cada tarefa tem ID estável `P<etapa>.<passo>` e caixa de conclusão. Usar `[ ]` para pendente e `[X]` somente depois de executar e verificar. Não renumerar tarefas concluídas; novas tarefas recebem novos IDs. As etapas seguem a ordem apresentada, salvo a prova de hospedagem indicada na etapa 8.

Ao concluir cada tarefa:

1. Conferir o resultado esperado e a verificação correspondente da etapa.
2. Marcar `[X]` na tarefa deste plano.
3. Registrar data, tarefa, requisitos relacionados, resultado, evidência e responsável no histórico de `requirements.md`.
4. Atualizar a evidência e marcar o requisito na matriz somente se o critério completo tiver sido atendido. Implementar parte do backend não conclui um requisito que também exige apresentação e interpretação no sistema.

As caixas já marcadas na etapa 0 indicam documentação revisada e confirmações fornecidas pelo grupo, não funcionalidades implementadas. P0.06 e P0.07 foram concluídos em 29/10/2026; os detalhes de coleta não fornecidos estão registrados na proveniência. A sequência de documentação não autoriza submissões externas automáticas.

## Etapa 0 — Preparar o escopo e as referências

**Dependência:** arquivos fornecidos pelo grupo. **Requisitos relacionados:** preparação de R01–R24.

- [X] **P0.01** — Revisar o enunciado e mapear suas exigências para R01–R24 na matriz de rastreabilidade.
- [X] **P0.02** — Definir Atlanta/Houston como foco, as sete variáveis obrigatórias e os limites do MVP na arquitetura.
- [X] **P0.03** — Documentar responsabilidades, fluxos, política de filtros e contratos previstos; atualizar o diagrama e sua fonte editável.
- [X] **P0.04** — Registrar fórmulas, convenções, casos de borda e parâmetros candidatos na metodologia.
- [X] **P0.05** — Mapear as 28 colunas para nomes canônicos, tipos, significados e elegibilidade no dicionário.
- [X] **P0.06** — Registrar a origem confirmada pelo grupo: dados reais NBA 2025–26, API oficial da NBA via `nba_api` em Python. Data exata, endpoints, parâmetros e tratamentos prévios não informados estão documentados na [proveniência](../data/provenance.md).
- [X] **P0.07** — Registrar FastAPI + React como stack confirmada externamente pelo grupo em 29/10/2026, com justificativa na [arquitetura](../architecture/architecture.md).

**Saída:** documentos de referência existentes, origem declarada e stack confirmadas; limitações da coleta registradas. Evidências de P0.01–P0.05: os arquivos vinculados no início deste plano; esses passos são a linha de base documental anterior à implementação.

## Etapa 1 — Criar a estrutura de desenvolvimento

**Dependência:** etapa 0 concluída; confirmações P0.06/P0.07 registradas. **Requisitos:** infraestrutura para R01, R05 e R06.

- [X] **P1.01** — Criar os diretórios de backend, núcleo científico, repositórios, scripts, conteúdo e testes conforme a arquitetura; reutilizar `data/raw/` e reservar `data/processed/` na raiz para os artefatos.
- [X] **P1.02** — Definir versões de Python e Node compatíveis com as dependências e hospedagem; registrá-las no repositório.
- [X] **P1.03** — Configurar o ambiente Python e dependências de runtime/desenvolvimento; gerar lock e `requirements.txt` reproduzível para execução.
- [X] **P1.04** — Configurar Ruff e pytest, separando testes científicos e de API.
- [X] **P1.05** — Criar `.gitignore` para ambientes, caches, builds e arquivos locais; preservar os insumos fornecidos sem sobrescrevê-los.
- [X] **P1.06** — Criar configuração central para caminhos de dados, IDs dos dois times e versões de schema/análise, sem espalhar constantes pelo código.
- [X] **P1.07** — Criar comandos documentados para lint, testes e build de dados; nesta etapa, registrar quais ainda dependem de código futuro.

**Verificação/saída:** ambiente Python instalável e estrutura utilizável. Validado em 29/10/2026 com `make setup`, `make check`, instalação isolada pelo requirements com hashes e conferência de integridade dos insumos. Dois testes de configuração aprovados; Ruff aprovado. `make data-build` retorna erro explícito por ainda não haver pipeline. Evidências e comandos: [ambiente de desenvolvimento](../development/setup.md) e [histórico](requirements.md).

## Etapa 2 — Ingerir e normalizar o CSV

**Dependência:** etapa 1. **Requisitos:** R07–R10.

- [ ] **P2.01** — Implementar a identificação da cópia bruta já preservada em `data/raw/stats_times_regular_final.csv`; calcular SHA-256, tamanho e metadados de leitura pelo pipeline e conferir com a proveniência.
- [ ] **P2.02** — Implementar leitor estrito com as 28 colunas esperadas, IDs como strings e erros claros para schema incompatível.
- [ ] **P2.03** — Aplicar o mapa original→canônico e validar tipos; converter WL para booleano somente após validar 0/1.
- [ ] **P2.04** — Converter datas estritamente, preservando a data civil; ordenar por time, data e partida para operações sequenciais.
- [ ] **P2.05** — Implementar registro de métricas com sigla original, nome canônico, rótulo, tipo, domínio, unidade e elegibilidade.
- [ ] **P2.06** — Gerar a base canônica mantendo os 30 times e todas as colunas; não remover outliers nem imputar zeros.
- [ ] **P2.07** — Criar seleção explícita dos dois times principais e vetor ordenado das sete variáveis, com justificativas de exclusão dos demais campos.
- [ ] **P2.08** — Verificar leitura, tipos e renomeações com exemplos válidos e inválidos; conferir a preservação dos IDs e do arquivo bruto.

**Verificação/saída:** 2.238 linhas, 28 campos de origem mapeados e 149 observações do grupo. A normalização é reproduzível e mantém proveniência.

## Etapa 3 — Validar qualidade e enriquecer o contexto

**Dependência:** etapa 2. **Requisitos:** R08, R11–R14.

- [ ] **P3.01** — Calcular por coluna missing, zeros, negativos e valores fora de domínio; identificar regras não aplicáveis.
- [ ] **P3.02** — Detectar duplicatas de linha e da chave time-partida; verificar IDs, nomes e contagens por time.
- [ ] **P3.03** — Validar contagens inteiras, percentuais, convertidos/tentados, FG3M≤FGM e identidades de pontos/rebotes com tolerâncias documentadas.
- [ ] **P3.04** — Parear adversários antes de restringir o grupo; validar duas linhas, times distintos, mesma data, resultado, placar e minutos coerentes.
- [ ] **P3.05** — Derivar adversário, pontos adversários, saldo, casa/fora e prorrogações, preservando os campos originais.
- [ ] **P3.06** — Conferir W/L/W_PCT e sequência observada; distinguir cobertura temporal de células ausentes.
- [ ] **P3.07** — Gerar cobertura global e por time, incluindo jogos, vitórias, casa/fora, prorrogações e confrontos diretos.
- [ ] **P3.08** — Implementar estados de não aplicabilidade dos testes de missingness; produzir conteúdo sobre MCAR/MAR/MNAR e os quatro procedimentos exigidos.
- [ ] **P3.09** — Testar duplicatas, data inválida, domínio inválido, adversário ausente, resultado contraditório e denominador zero.
- [ ] **P3.10** — Produzir relatório de qualidade, separando regras bloqueantes de alertas legítimos; impedir publicação de base inválida.

**Verificação/saída:** relatório reproduz a auditoria; Atlanta tem 75 jogos e Houston 74; 147 partidas distintas no recorte. Inaplicabilidade estatística não é erro nem resultado de teste executado.

## Etapa 4 — Implementar descritivas e distribuições

**Dependência:** etapas 2–3. **Requisitos:** R16–R23.

- [ ] **P4.01** — Implementar média, mediana, modas/frequência, mínimo, máximo e amplitude para cada variável/time.
- [ ] **P4.02** — Implementar variância e desvio com ddof=1, quartis lineares e IQR.
- [ ] **P4.03** — Implementar CV percentual, validade da média e avisos; identificar separadamente eventual razão robusta IQR/mediana.
- [ ] **P4.04** — Implementar assimetria ajustada, direção e intensidade pelos critérios documentados.
- [ ] **P4.05** — Definir saída por medida com estados e motivos para n=0/1/2, série constante e resultados indefinidos; não serializar NaN/infinito.
- [ ] **P4.06** — Calcular cercas, bigodes, média, modas e outliers do boxplot no Python; incluir IDs dos registros sinalizados.
- [ ] **P4.07** — Calcular bins, densidade do histograma e KDE; usar bins comuns na comparação e registrar banda/fallbacks.
- [ ] **P4.08** — Produzir tabelas comparativas de medidas, quadros CV/IQR 7×2 e tabela Q1/Q3/IQR.
- [ ] **P4.09** — Validar fórmulas com exemplos pequenos calculáveis manualmente e casos de borda; conferir cercas inclusivas e IQR zero.
- [ ] **P4.10** — Reproduzir as referências exploratórias de pontos e modas da metodologia a partir do CSV identificado pelo hash.

**Verificação/saída:** resultados completos das sete variáveis para os dois times, sem arredondar intermediários. Boxplots e tabelas consomem o mesmo resultado científico.

## Etapa 5 — Implementar e validar detecção de outliers

**Dependência:** etapas 3–4. **Requisitos:** R14, R15 e R23.

- [ ] **P5.01** — Criar contrato comum de resultado com referência, parâmetros, registros, score/direção, limiar e avisos específicos de cada método.
- [ ] **P5.02** — Implementar Z-score amostral com limiar explícito e tratamento de variância zero.
- [ ] **P5.03** — Implementar detecção IQR reutilizando os mesmos limites do boxplot; listar quantidades e partidas por variável/time.
- [ ] **P5.04** — Implementar Grubbs bilateral com G, crítico e decisão; documentar normalidade/multiplicidade e evitar remoção iterativa.
- [ ] **P5.05** — Preparar vetor multivariado por time, amostra mínima, exclusão registrada de constantes e escalonamento ajustado à referência.
- [ ] **P5.06** — Implementar k-NN, excluindo o próprio registro e preservando o critério de distância escolhido.
- [ ] **P5.07** — Implementar LOF para o histórico, orientando os scores e distinguindo o limiar explícito dos rótulos automáticos.
- [ ] **P5.08** — Implementar DBSCAN com clusters/ruído e parâmetros completos, sem inventar score contínuo.
- [ ] **P5.09** — Fixar revisão da referência ECOD, licença/atribuição aplicável, fixtures e tolerâncias numéricas.
- [ ] **P5.10** — Implementar ECOD com caudas empíricas, empates, assimetria e contribuições conforme a referência; validar contra fixtures.
- [ ] **P5.11** — Implementar política explícita de limiares e empates para os métodos com score, sem forçar quantidade de anomalias.
- [ ] **P5.12** — Executar sensibilidade de k, escalonamento e eps por time; comparar rankings, conjuntos e estabilidade, sem tratá-la como acurácia.
- [ ] **P5.13** — Selecionar configurações finais com justificativa, atualizar a metodologia e versionar parâmetros e relatório de sensibilidade.
- [ ] **P5.14** — Validar empates, permutação de linhas, séries constantes, vizinhança e DBSCAN sem ruído/todo ruído; confrontar IQR com os registros do boxplot.

**Verificação/saída:** sete métodos disponíveis, com pressupostos e resultados verificáveis. Publicar scores somente após P5.13; não exigir que todo método encontre anomalias ou concorde com os demais.

## Etapa 6 — Construir os artefatos reproduzíveis

**Dependência:** etapas 3–5. **Requisitos:** sustentação de R07–R23 e R06.

- [ ] **P6.01** — Definir schemas versionados dos arquivos canônicos, descritivas, distribuições, qualidade, anomalias e conteúdo associado.
- [ ] **P6.02** — Implementar comando único de build dos dados reutilizando as funções científicas, sem fórmulas duplicadas.
- [ ] **P6.03** — Gerar manifesto com hash do CSV, versões, código, dependências, parâmetros, ordem das features e hashes de saída.
- [ ] **P6.04** — Validar schemas, valores finitos/nulos e consistência entre arquivos antes de promover um conjunto completo de artefatos.
- [ ] **P6.05** — Rodar o build duas vezes e comparar conteúdo determinístico, isolando timestamps e outros metadados de geração.
- [ ] **P6.06** — Definir quais artefatos/dependências integram o runtime e quais ficam apenas no pipeline; registrar a decisão para os cálculos online.

**Verificação/saída:** conjunto consistente, rastreável e reconstruível; artefato ausente/incompatível gera falha explícita, sem resultados parciais apresentados como completos.

## Etapa 7 — Implementar a API Python

**Dependência:** contratos da arquitetura e artefatos da etapa 6; schemas podem ser preparados antes. **Requisitos:** suporte a R01–R24.

- [ ] **P7.01** — Criar aplicação FastAPI, configuração e schemas Pydantic de resultados, metadados e erros.
- [ ] **P7.02** — Implementar repositório de leitura dos artefatos, validação de versões e carregamento controlado.
- [ ] **P7.03** — Implementar filtros inclusivos de data, mando e resultado, com referência explícita; validar combinações por allowlist.
- [ ] **P7.04** — Disponibilizar `/health`, `/meta`, `/dictionary` e `/teams`, distinguindo times principais e contexto.
- [ ] **P7.05** — Disponibilizar summary, distributions e comparisons; chamar as mesmas funções científicas para descritivas filtradas.
- [ ] **P7.06** — Disponibilizar anomalies, mantendo ajuste sobre o histórico completo e filtros só na exibição; incluir reference_n/display_n.
- [ ] **P7.07** — Disponibilizar quality e interpretations; vincular textos ao contexto e evidências corretos.
- [ ] **P7.08** — Implementar estados por medida, nulls e respostas 404/422/503; distinguir seleção vazia de erro de infraestrutura.
- [ ] **P7.09** — Expor OpenAPI e gerar tipos TypeScript; definir identidade de cache por dataset, análise e parâmetros.
- [ ] **P7.10** — Testar contratos, filtros equivalentes entre endpoints, datas-limite, consultas vazias, IDs fora de escopo e artefatos incompatíveis.

**Verificação/saída:** API utilizável sem frontend, resultados rastreáveis e documentação de endpoints. Testes incluem ambos os times e não se limitam a respostas HTTP 200.

## Etapa 8 — Criar a base React e provar a hospedagem

**Dependência:** P0.07 já confirmado; etapa 7 para integração real. O esqueleto e a prova inicial podem antecipar etapas 4–6; repetir a medição com o pacote final quando ele mudar.

**Requisitos:** R01, R03–R05.

- [ ] **P8.01** — Criar frontend Vite/React/TypeScript, lock de dependências e configuração de lint/formatação/Vitest.
- [ ] **P8.02** — Instalar e configurar roteador, TanStack Query/Table, ECharts e componentes visuais necessários.
- [ ] **P8.03** — Criar layout, navegação, tokens visuais, rótulos e formatação centralizada de unidades/casas decimais.
- [ ] **P8.04** — Criar cliente HTTP tipado, filtros na URL e chaves de cache com versão e contexto; invalidar ao trocar dataset/análise.
- [ ] **P8.05** — Criar componentes de carregamento, erro, vazio, insuficiência de amostra, avisos e tabelas acessíveis.
- [ ] **P8.06** — Preparar configuração local de frontend/API e escolher topologia de deploy mediante prova com dependências reais.
- [ ] **P8.07** — Publicar uma versão de validação técnica e verificar `/api`, health, artefatos, recarga de rota profunda e CORS se houver duas origens.
- [ ] **P8.08** — Medir tamanho do pacote, cold start e duração de consultas representativas; documentar limites e corrigir incompatibilidades.

**Verificação/saída:** estrutura navegável e integração funcionando localmente e em ambiente de validação. A URL técnica ainda não comprova conclusão do relatório acadêmico.

## Etapa 9 — Implementar as páginas do relatório

**Dependência:** etapas 4–8. **Requisitos:** R02–R04 e R07–R24.

- [ ] **P9.01** — Criar `/dados` com dimensões, período, origem/limitação, dicionário completo, tipos e transformações.
- [ ] **P9.02** — Apresentar qualidade por coluna, inconsistências entre linhas, missingness e teoria/aplicabilidade dos testes exigidos.
- [ ] **P9.03** — Criar perfil dos dois times com seleção de variável e tabela de todas as medidas obrigatórias.
- [ ] **P9.04** — Construir boxplot com quartis, média, mediana, todas as modas, cercas, bigodes e outliers identificáveis.
- [ ] **P9.05** — Construir histograma/KDE e bloco de assimetria com fórmula, direção, intensidade e discussão visual.
- [ ] **P9.06** — Criar `/comparar` com barras de mesma unidade e escala; explicar onde o z-score pode ser usado e suas referências.
- [ ] **P9.07** — Exibir quadros CV/IQR 7×2 e tabela Q1/Q3/IQR; discutir média, desvio, amplitude, assimetria e alternativas robustas.
- [ ] **P9.08** — Criar `/fora-da-curva` com seleção de método, parâmetros, referência, scores/ruído e tabela das partidas sinalizadas.
- [ ] **P9.09** — Redigir interpretações por variável/time a partir dos resultados validados; discutir prorrogações e diferenças de cobertura sem inferência causal.
- [ ] **P9.10** — Criar síntese na página inicial, ligando conclusões às evidências; separar históricos completos de confrontos diretos.
- [ ] **P9.11** — Vincular cada seção aos requisitos correspondentes e disponibilizar métodos/limitações junto dos resultados relevantes.
- [ ] **P9.12** — Revisar textos após filtros: recalcular o que for contextual ou identificar claramente o escopo fixo; não manter conclusão incompatível com a seleção.

**Verificação/saída:** todos os itens acadêmicos localizáveis dentro da aplicação; documentação do repositório não substitui o relatório web. Cada página apresenta dados e interpretação.

## Etapa 10 — Validar integração, conteúdo e acessibilidade

**Dependência:** etapa 9. **Requisitos:** revisão integral R01–R24, exceto submissão final.

- [ ] **P10.01** — Executar verificações científicas/API e testes das interações relevantes; corrigir falhas antes de ampliar escopo.
- [ ] **P10.02** — Conferir os 14 pares variável/time e os quadros comparativos; validar unidades, casas decimais, títulos, eixos e legendas.
- [ ] **P10.03** — Conferir cada partida outlier no CSV, tabela e gráfico; diferenciar cerca, bigode, score e decisão do detector.
- [ ] **P10.04** — Percorrer Dados → Perfil → Comparação → Anomalias → Síntese para ambos os times e registrar evidências por requisito.
- [ ] **P10.05** — Testar navegação por teclado, leitura de tabelas, contraste, modas sobrepostas e uso em telas menores.
- [ ] **P10.06** — Testar URL compartilhada, recarga, mudança de filtros, seleção vazia, falha da API e resultados indefinidos.
- [ ] **P10.07** — Verificar cache após mudança de versão e referência fixa dos detectores; conferir que textos acompanham o contexto.
- [ ] **P10.08** — Revisar toda a matriz: marcar somente requisitos integralmente atendidos, manter parciais abertos e registrar correções restantes.

**Verificação/saída:** evidências concretas de funcionamento e conteúdo científico. Testes validam propriedades e contratos, não apenas espelham a implementação. A existência de testes aprovados não substitui a revisão das interpretações.

## Etapa 11 — Preparar reprodução e entrega

**Dependência:** etapa 10 sem falhas impeditivas. **Requisitos:** R05, R06 e fechamento dos demais.

- [ ] **P11.01** — Completar o README inicial com requisitos de ambiente, stack justificada, limitações de execução e URL da aplicação; manter os links e a estrutura atualizados.
- [ ] **P11.02** — Disponibilizar requirements.txt/locks e comando único que orquestre artefatos, API e frontend; documentar a instalação inicial separadamente.
- [ ] **P11.03** — Reproduzir instalação e execução a partir de checkout limpo, sem depender de arquivos locais não entregues.
- [ ] **P11.04** — Configurar CI para lint, verificações científicas/API, validação de artefatos e build do frontend; corrigir falhas.
- [ ] **P11.05** — Atualizar o deploy com a versão validada e verificar acesso público em sessão limpa, rotas profundas e consultas reais.
- [ ] **P11.06** — Registrar procedimento de restabelecimento da hospedagem e alternativa local; conferir artefatos e dependências finais.
- [ ] **P11.07** — Identificar a revisão de entrega e preparar repositório ou zip completo, incluindo insumos cuja distribuição seja permitida e instruções necessárias.
- [ ] **P11.08** — Fazer revisão final de R01–R24 com evidências e datas; R06 permanece parcial enquanto a submissão exigida não estiver confirmada.
- [ ] **P11.09** — Entregar ao grupo o código, link público e instruções; conferir os arquivos e URLs destinados ao Classroom.
- [ ] **P11.10** — Grupo realiza a submissão no Classroom e confirma o envio; registrar confirmação e fechar R06 quando o critério completo for atendido.

**Verificação/saída:** versão reproduzível, aplicação acessível, requisitos comprovados e submissão confirmada pelo grupo. Preparar a entrega não equivale a enviá-la.

## Extensões após a entrega obrigatória

Evolução temporal, outros times, normalização por tempo e recálculo dos detectores sob filtros terão tarefas próprias se forem incluídos no escopo. Não antecipá-los ao fechamento dos requisitos obrigatórios nem considerá-los necessários para concluir este plano.
