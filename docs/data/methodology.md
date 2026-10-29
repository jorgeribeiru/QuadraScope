# Metodologia científica — QuadraScope

> Especificação para implementação, revisada em 29/10/2026. Ingestão, auditoria interna, cobertura e enriquecimento implementados nas etapas 2–3, com testes. Cálculos estatísticos e detectores ainda não implementados.

A origem NBA via `nba_api` foi informada pelo grupo; os detalhes conhecidos e não informados estão na [proveniência](provenance.md). O [CSV preservado](../../data/raw/stats_times_regular_final.csv) é a entrada reproduzível da análise.

## Unidade de análise

Uma observação é um time em uma partida. Chave: `(team_id, game_id)`. Atlanta e Houston somam 149 observações e 147 partidas. Não assumir independência para inferência: adversários pareados e sequência temporal introduzem dependências. O estudo descreve o recorte fornecido; não estima causalidade, prevê resultados ou representa temporada completa.

Parear adversários por `game_id` antes de restringir os times. Exigir duas linhas, times diferentes, mesma data, uma vitória, uma derrota e coerência com o placar e tempo agregado. Extrair casa/fora de `MATCHUP` (`vs.`/`@`), preservando o original. Falhas de parsing são inconsistências. Datas são datas civis de partida, sem conversão artificial de fuso; serializar `YYYY-MM-DD`.

## Convenções descritivas

| Medida | Regra |
| --- | --- |
| Média | Soma / n |
| Mediana | Quantil 0,5 linear |
| Moda | Todos os valores de frequência máxima em ordem crescente, com frequência |
| Sem repetição | `modes=[]` com motivo “sem moda repetida”; não marcar todos os valores |
| Constante, n≥2 | Moda única, variância/desvio/amplitude iguais a zero |
| Extremos e amplitude | Mínimo, máximo e `max-min` |
| Variância e desvio | Amostrais, `ddof=1`; variância em unidade² |
| Quartis | `numpy.quantile(..., method="linear")`, 0,25 e 0,75 |
| IQR | Q3 − Q1 |
| CV | `100*s/média`, com s amostral; % |
| Assimetria | Fisher–Pearson ajustado, `scipy.stats.skew(x, bias=False)` |

A correção amostral é convenção uniforme do grupo para a variabilidade entre jogos, não prova de amostragem aleatória. Quartis lineares tornam o cálculo explícito e reproduzível. A assimetria ajustada explicita correção por tamanho amostral. [NumPy](https://numpy.org/doc/stable/reference/generated/numpy.quantile.html), [SciPy](https://docs.scipy.org/doc/scipy/reference/generated/scipy.stats.skew.html).

Com n=0 não há medidas. Com n=1, média, mediana, quartis e extremos seguem suas definições; variância, desvio e CV são indefinidos. Assimetria ajustada requer n≥3 e variância positiva. Série constante tem assimetria indefinida, não zero. Estados são por medida, permitindo valores válidos junto dos indefinidos.

CV exige escala de razão e média positiva. As sete variáveis são contagens; média zero torna CV indefinido. Média baixa e granularidade discreta, especialmente BLK/STL, exigem contextualização. Não existe corte universal de “CV bom” ou média pequena. Mostrar média/desvio junto do CV; não atribuir CV alto exclusivamente ao denominador.

Complemento robusto possível: `IQR/mediana` para mediana positiva, identificado por nome próprio, sem equivalência automática ao CV. Comparar IQR bruto entre times para a mesma variável, não dispersão relativa de variáveis em escalas distintas.

Assimetria: positivo=direita, negativo=esquerda, zero numérico=direção neutra. Intensidade descritiva: |G1|<0,5 aproximadamente simétrica; 0,5≤|G1|<1 moderada; |G1|≥1 forte. Isso não é teste de hipótese. Confrontar coeficiente, histograma/KDE e boxplot; discutir diferenças e adequação de média/mediana, sem recomendar transformação automaticamente.

## Boxplot e comparação

Regra principal IQR: k=1,5; cercas `Q1-k*IQR` e `Q3+k*IQR`. Outlier satisfaz desigualdade estrita; igual ao limite permanece dentro. Bigodes são as observações extremas dentro das cercas, não os limites teóricos. Se IQR=0, manter a regra e avisar da degeneração, sem substituir método silenciosamente.

Payload: Q1, mediana, Q3, média, modas/frequência, cercas, bigodes e todos os registros fora das cercas. O ECharts só desenha. Modas múltiplas devem aparecer integralmente por marcadores ou anotação acessível. Identificar todos os elementos exigidos no gráfico e tabela.

Barras comparam mesma variável e medida com eixo comum começando em zero para magnitudes. Não misturar variância e desvio na mesma escala. Z-score é comparação complementar com referência explícita; a média de z-scores calculados separadamente dentro de cada time é zero e não compara o desempenho médio.

## Histograma e KDE

Histograma em densidade para compartilhar escala com KDE, em unidade inversa da variável. Ao comparar times, usar bins comuns para a mesma variável e seleção. Proposta: Freedman–Diaconis nos dados combinados, com fallback de Sturges se largura nula. Limites devem respeitar legibilidade de contagens inteiras.

KDE gaussiana com banda de Scott, calculada no Python e identificada como suavização de contagens discretas. Não executar em série constante ou n<2. Suavização pode atribuir densidade fora do domínio; limitar o eixo não corrige essa propriedade do estimador. [SciPy](https://docs.scipy.org/doc/scipy/reference/generated/scipy.stats.gaussian_kde.html).

## Outliers univariados

Aplicação principal por variável e time, no histórico completo do time neste dataset. Não remover registros automaticamente. Sinalização é atipicidade segundo uma regra, não prova de erro.

| Método | Especificação |
| --- | --- |
| Z-score | `z=(x-média)/s`, s amostral; sinalizar `abs(z)>3`; n≥2 e s>0 |
| IQR | Regra acima; quantidade e registros por variável |
| Grubbs | Bilateral, α=0,05, n≥3, s>0; um teste para um extremo |

Grubbs: `G=max(abs(x-média))/s`; `t=t.ppf(1-α/(2*n), df=n-2)`; `Gcrit=((n-1)/sqrt(n))*sqrt(t²/(n-2+t²))`. Rejeitar ausência de outlier se G>Gcrit. Candidatos empatados não significam rejeições independentes. Não remover o extremo e repetir até “limpar” a base.

Pressuposto: distribuição aproximadamente normal, cuja adequação deve ser discutida por gráficos e contexto das contagens. Os 14 testes (sete variáveis × dois times) têm multiplicidade: α é nominal por teste, sem garantia de erro familiar a 5%. Interpretação exploratória, sem conclusões confirmatórias. [NIST](https://www.itl.nist.gov/div898/handbook/eda/section3/eda35h1.htm).

## Métodos multivariados

Ordem fixa: `[PTS,REB,AST,STL,BLK,PF,FG3M]`. Excluir identificadores, datas brutas, resultado e acumulados. Ajustar separadamente por time. Mínimo operacional inicial n≥20 e ausência de valores inválidos; não é garantia estatística. Excluir colunas constantes do vetor efetivo com registro; nenhuma dimensão restante implica não aplicabilidade.

Distâncias: `StandardScaler` ajustado à referência do próprio time e distância euclidiana, como configuração candidata. Comparar com `RobustScaler` antes de congelar. ECOD trabalha nos dados originais e não requer esse escalonamento.

| Método | Configuração candidata para validação | Saída |
| --- | --- | --- |
| k-NN | k=10; distância ao décimo vizinho, excluindo o próprio registro | Maior escore = mais atípico |
| LOF | n_neighbors=10, novelty=False; fit_predict e negative_outlier_factor_ no histórico | Preservar score bruto; escore apresentado = seu negativo |
| DBSCAN | min_samples=5; avaliar eps=1,0/1,5/2,0/2,5/3,0 após escalonamento | Cluster e is_noise=(label==-1); sem score contínuo obrigatório |
| ECOD | Implementação específica segundo artigo e referência | Escore agregado e contribuições por dimensão |

Para ECOD, k-NN e LOF, corte candidato: quantil 0,95 linear dos escores orientados para maior atipicidade; sinalizar estritamente score>limiar. É seleção relativa de cauda, não taxa verdadeira de erro/contaminação. Empates podem produzir menos sinalizações; não forçar 5%. Para LOF, esse corte explícito difere dos rótulos automáticos da biblioteca: identificar qual política gerou is_outlier e não misturar critérios.

**Esses parâmetros ainda não estão validados.** Antes da publicação, comparar k=5/10/15, escalonamentos e faixa de eps; registrar estabilidade de rankings/conjuntos por time. Escolher configuração explicável, sem otimizar quantidade desejada de anomalias. Se DBSCAN não produzir estrutura estável, mostrar a limitação em vez de inventar clusters. Configuração final e sensibilidade são artefatos obrigatórios para publicação.

LOF de outliers no histórico não é detecção de novidades futuras. Scores dos dois times têm referências diferentes e não compõem ranking absoluto. Concordância entre métodos não é acurácia; não há rótulos verdadeiros de anomalia. [scikit-learn](https://scikit-learn.org/stable/modules/outlier_detection.html).

### ECOD: referência e validação

Referência normativa: [artigo ECOD](https://arxiv.org/abs/2201.00382). A [implementação dos autores](https://github.com/yzhao062/pyod/blob/master/pyod/models/ecod.py) serve de oráculo, sem PyOD no runtime. Fixar revisão exata antes de gerar fixtures; master é apenas localizador inicial.

Calcular CDF inferior P(X≤x) e superior P(X≥x) diretamente: a superior não é 1−F(x) com empates. No ajuste, as probabilidades são pelo menos 1/n. Transformar por log negativo, selecionar/agregar caudas e assimetria conforme referência e somar contribuições. Documentar a convenção interna de assimetria separadamente do coeficiente ajustado descritivo.

Validar probabilidades, contribuições e escore em exemplos com empates, caudas opostas, colunas constantes, simetria e permutação de linhas. Fixar tolerância numérica. Não substituir o ECOD por fórmula genérica de raridade. Score e limiar são decisões separadas.

## Qualidade e missingness

Por coluna: n, missing, zeros, negativos, fora de domínio e regras aplicadas. Duplicatas e consistências entre campos/linhas têm tabelas próprias. Identificadores/texto não recebem detector numérico: usar não aplicável, não “zero outliers” como se tivesse sido executado.

Verificar chave, datas, IDs, WL∈{0,1}, contagens inteiras não negativas, percentuais∈[0,1], convertidos≤tentados, FG3M≤FGM, identidades `2*FGM+FG3M+FTM=PTS` e `OREB+DREB=REB`, pareamento e acumulados. Percentuais a três casas: tolerância absoluta 0,00050001. Tentativas zero tornam a razão indefinida; documentar convenção da fonte, sem dividir por zero/imputar automaticamente.

O CSV atual tem zero células ausentes; não imputar. Zeros em tocos/roubos são possíveis. Isso não comprova ausência de jogos omitidos ou tratamento anterior.

| Abordagem | Discussão e aplicabilidade |
| --- | --- |
| MCAR | Ausência independente dos valores observados/não observados; zero missing não prova MCAR |
| MAR | Ausência pode depender dos observados, condicionalmente às variáveis consideradas |
| MNAR | Dependência do valor não observado após condicionar nos observados; hipóteses/sensibilidade |
| Little | Teste global de MCAR; pressupostos e padrões de ausência; não aplicável sem missing |
| Jamshidian–Jalal | Discutir procedimento e pressupostos; não aplicável sem padrões de ausência |
| Listing–Schlittgen | Discutir desenho e restrições, incluindo padrão monotônico na formulação citada |
| Fairclough | Regressão da ausência em contexto longitudinal; indicador constante inviabiliza ajuste atual |

Não rejeitar MCAR não prova MCAR. Testes usuais não distinguem genericamente MAR/MNAR apenas pelos dados observados. [mice](https://amices.org/mice/reference/mcar.html), [estudo comparativo](https://link.springer.com/article/10.1186/1477-7525-7-57).

Demonstração sintética é opcional, separada, com gerador e semente. SciPy fornece funções de distribuição, não automaticamente a implementação integral de Little e dos demais procedimentos.

## Modelagem futura e interpretações

Preservar as 28 colunas canônicas; exclusões do vetor analítico são justificadas no [dicionário](data-dictionary.md). Não apagar proveniência para satisfazer uma instrução sobre modelos que ainda não serão treinados.

W/L/W_PCT são acumulados pós-partida, não medidas independentes por jogo. Win rate do recorte = sum(WL)/n, não média de W_PCT. Em futura previsão pré-jogo, resultado e estatísticas pós-jogo são vazamento; definir alvo e instante de previsão antes das features.

Prorrogações: análise principal usa totais. Extensão possível `valor*240/MIN` é equivalente por 48 minutos, não contagem observada no tempo regulamentar nem ajuste por posses. Não inferir pace/eficiência por posse sem dados e fórmula adequados.

Interpretações ligam medida, resultado, comparação e limitação. “Mais regular” precisa citar CV/IQR/desvio; média maior não define “time melhor”. Texto fixo identifica dataset e filtros válidos.

## Exemplos para verificação futura

Quartis lineares, ddof=1, IQR 1,5, CSV identificado pelo hash da arquitetura:

- Atlanta PTS: Q1=110,5; Q3=126; IQR=15,5; cercas=87,25 e 149,25; outliers 150 no jogo 22500396 e 86 no jogo 22500682.
- Houston PTS: modas [111,117,119,124]; Atlanta STL: modas [9,11].
- Atlanta PTS: média≈118,253333, CV≈10,6551%; Houston PTS: média≈114,405405, CV≈9,7837%.

São referências exploratórias a recalcular, não testes automatizados já aprovados. Complementar com exemplos sintéticos para fórmulas e estados de borda.
