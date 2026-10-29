# Detecção de outliers e sensibilidade — etapa 5

## Executar

```bash
make data-anomalies
make check
```

Equivalente somente uv, a partir da raiz:

```bash
uv run --locked python -m backend.scripts.detect_anomalies
```

O comando verifica o CSV e seu hash, executa a auditoria em memória, carrega os parâmetros revisados e recalcula a sensibilidade. Scores só são gerados se a configuração corresponder ao snapshot e a seleção for reproduzida. Fonte ou qualidade inválidas bloqueiam o comando e invalidam resultados anteriores. Não depende de Parquets antigos nem acessa a NBA para coletar novos dados.

## Arquivos e contrato comum

```text
data/processed/anomalies/
├── status.json       # Aprovação/bloqueio, fonte, versões e parâmetros
├── anomalies.json    # 42 análises univariadas + 8 multivariadas e resumo
└── sensitivity.json  # Grades, scores, conjuntos sinalizados, correlações e seleção
```

São intermediários locais ignorados pelo Git; manifesto e publicação transacional finais continuam na etapa 6. Em execução bloqueada, só fica o diagnóstico de status, com retirada dos dois resultados antigos.

Cada resultado identifica método, time, variável(s), unidades originais e do score, população e período de referência, `reference_n`, `display_n`, estado, parâmetros, limiar, direção do score, quantidade e registros. Cada registro preserva IDs, data, matchup, valores, score, score bruto quando houver e `is_outlier`.

Na execução atual, referência é o histórico completo de cada time no dataset e exibição contém todos esses registros. A API futura poderá filtrar a exibição conservando essa referência e seus scores; não apresentar o filtro como novo ajuste. Scores ajustados separadamente para Atlanta/Houston não são uma escala absoluta comum.

`empty`, `insufficient_sample` e `constant_series` não equivalem a zero anomalias: contagem, scores e decisões ficam `null` quando não foi possível executar. DBSCAN e IQR não recebem score contínuo inventado. Atipicidade não demonstra erro e nunca remove partidas automaticamente.

## Métodos univariados

| Método | Regra e saída |
| --- | --- |
| Z-score | z=(x−média)/s amostral; score=abs(z), bruto=z; sinalização estrita score>3 |
| IQR | Q1−1,5×IQR e Q3+1,5×IQR; reusa `iqr_limits` da etapa 4, quartis lineares e desigualdade estrita |
| Grubbs | Bilateral, α=0,05, n≥3 e s>0; G=max(abs(z)), crítico t, um teste sem remoção iterativa |

Z-score exige n≥2 e desvio positivo. IQR zero mantém cercas coincidentes com aviso. Valores iguais às cercas permanecem dentro; as partidas sinalizadas coincidem com o boxplot.

Em Grubbs, o limiar se refere ao teste global do extremo, não à classificação independente de cada observação. Registrar candidatos, G, crítico e rejeição. Se candidatos empatados implicarem rejeição, marcar atribuição ambígua, decisões dos candidatos e contagem como `null`; não chamar cada empate de uma rejeição independente. O algoritmo não elimina o máximo e repete.

Normalidade aproximada, natureza discreta e multiplicidade dos 14 testes precisam ser discutidas. α é nominal por teste; não há controle familiar a 5% nem p-valor inventado. Referência primária: [NIST — Grubbs](https://www.itl.nist.gov/div898/handbook/eda/section3/eda35h1.htm).

## Métodos multivariados

Ordem de entrada: PTS, REB, AST, STL, BLK, PF, FG3M. Exigir mínimo operacional n≥20, observações finitas e ao menos uma dimensão variável. O mínimo não garante validade estatística. Excluir colunas constantes com registro e preservar os valores originais em cada partida.

Para distâncias, StandardScaler é ajustado separadamente na referência completa do time. Registrar centro, escala e features utilizadas. Sua convenção ddof=0 pertence ao escalonamento; as descritivas permanecem amostrais ddof=1. RobustScaler com mediana/IQR é análise de sensibilidade; fatores efetivos também são registrados.

| Método | Pontuação / decisão |
| --- | --- |
| k-NN | Distância euclidiana ao décimo vizinho externo; remover o índice do próprio registro explicitamente, inclusive com pontos duplicados |
| LOF | Densidade local relativa; score = −negative_outlier_factor_; novidade desativada e ajuste no histórico com fit_predict |
| DBSCAN | Agrupamento por densidade; label −1 indica ruído; score e limiar contínuo ficam null |
| ECOD | Caudas empíricas inclusivas por dimensão, transformação log negativa, agregação conforme referência fixada |

ECOD/k-NN/LOF usam corte operacional no quantil 0,95 linear, estritamente score>limiar. Isso seleciona a cauda relativa; não estima taxa verdadeira de erro/contaminação ou probabilidade de anomalia. Empates exatos não são quebrados para forçar 5%. No LOF, os rótulos e offset automáticos da biblioteca são preservados como informação separada; não geram a decisão final.

DBSCAN usa eps=2,5, min_samples=5 e distância euclidiana no espaço padronizado. A contagem mínima inclui o próprio ponto. Todo ruído ou nenhum ruído são resultados possíveis, acompanhados de aviso. Referências: [NearestNeighbors](https://scikit-learn.org/stable/modules/generated/sklearn.neighbors.NearestNeighbors.html), [LOF](https://scikit-learn.org/stable/modules/generated/sklearn.neighbors.LocalOutlierFactor.html), [DBSCAN](https://scikit-learn.org/stable/modules/generated/sklearn.cluster.DBSCAN.html).

## ECOD: oráculo, licença e fixtures

Referência normativa: [artigo ECOD](https://arxiv.org/abs/2201.00382). Oráculo fixado na revisão **7e1330e10ac5c56ed402fbbaa41b225efb4bbc5c** do [código dos autores](https://github.com/yzhao062/pyod/blob/7e1330e10ac5c56ed402fbbaa41b225efb4bbc5c/pyod/models/ecod.py). Autores: Zheng Li e Yue Zhao. Licença [BSD-2-Clause preservada](../references/pyod-ecod-LICENSE.txt).

O [ECOD próprio](../../backend/analytics/ecod.py) computa P(X≤x) e P(X≥x) com empates inclusivos, sem substituir a cauda superior por 1−F(x). Usa assimetria com bias=True internamente, conforme o oráculo; a assimetria descritiva continua bias=False. Quando o sinal é exatamente zero, a contribuição também considera a soma das duas caudas logarítmicas. Assimetria constante/numericamente indefinida segue o fallback da referência, registrado nos metadados. Não é uma fórmula genérica de raridade renomeada.

[Fixtures versionadas](../../backend/tests/fixtures/ecod-reference.json) contêm entradas, scores, contribuições e probabilidades para seis casos: simétrico, cauda direita, cauda esquerda, empates com constante, constante e quase constante. Foram geradas pelo PyOD real da revisão fixada em ambiente isolado, com NumPy 2.5.4, SciPy 1.18.1 e scikit-learn 1.9.1. Comparação com rtol=atol=1e−12, além de testes de permutação.

PyOD **não está instalado na .venv do projeto** e não integra pyproject, lock ou requirements. Os testes normais são offline e usam as fixtures. Para regenerá-las deliberadamente, com acesso à rede, usar o [gerador](../../backend/scripts/generate_ecod_reference.py):

```bash
uv run --isolated --no-project --python 3.12 \
  --with 'pyod @ git+https://github.com/yzhao062/pyod.git@7e1330e10ac5c56ed402fbbaa41b225efb4bbc5c' \
  --with numpy==2.5.4 --with scipy==1.18.1 --with scikit-learn==1.9.1 \
  python -m backend.scripts.generate_ecod_reference
```

O gerador confere o commit no metadado VCS da distribuição antes de escrever as fixtures. Uma versão PyPI com o mesmo nome não substitui essa verificação. A contaminação do oráculo serve apenas ao seu fit; fixtures e comparação usam os scores brutos, não seus rótulos.

## Sensibilidade e parâmetros revisados

[anomaly-parameters.json](../../backend/content/anomaly-parameters.json) fixa versão **1.0.0**, hash do dataset, ordem de features, amostra mínima, escala, limiares e justificativa. O [relatório compacto versionado](../data/anomaly-sensitivity.json) preserva todas as 44 variantes, parâmetros e conjuntos sinalizados; os vetores completos de scores permanecem no artefato local. Alterações exigem nova revisão e versionamento; não atualizar valores para obter um resultado desejado.

Grade por time: k=5/10/15 × StandardScaler/RobustScaler para k-NN e LOF; eps=1/1,5/2/2,5/3 × as duas escalas para DBSCAN. São 44 variantes no total. Scores, rótulos e registros ficam disponíveis no relatório. Spearman compara rankings com StandardScaler/k=10; Jaccard compara conjuntos sinalizados. Correlação indefinida fica null; Jaccard de dois conjuntos vazios é 1 por convenção, sem representar acurácia.

k=10 permanece como valor intermediário pré-especificado. Para eps, calcular a curva de distância ao quarto vizinho externo na escala padrão (min_samples=5 inclui o próprio ponto). O joelho é a maior distância abaixo da corda normalizada entre extremos da curva. Escolher o candidato de eps mais próximo da mediana dos joelhos por time, com empate favorecendo o menor; a quantidade de ruído não entra no critério.

Joelhos observados: Atlanta=2,2753180085993856; Houston=2,5100108133169834; mediana=2,3926644109581847 → candidato eps=2,5. O comando verifica que a seleção e essa medida reproduzem a configuração revisada antes de gerar scores.

| Time / método | Spearman mínimo | Spearman mediano | Jaccard mínimo | Jaccard mediano |
| --- | --- | --- | --- | --- |
| Atlanta k-NN | 0,9102 | 0,9640 | 0,6000 | 1,0000 |
| Atlanta LOF | 0,8478 | 0,9363 | 0,6000 | 0,6000 |
| Houston k-NN | 0,9420 | 0,9495 | 0,3333 | 0,6000 |
| Houston LOF | 0,8079 | 0,9097 | 0,3333 | 0,6000 |

Os rankings são relativamente consistentes, mas a identidade das partidas sinalizadas é sensível. DBSCAN vai de todo ruído a nenhum ruído na grade. Na configuração principal, há um cluster em cada time, mais 4 registros de ruído no Atlanta e 2 no Houston. Três clusters aparecem somente em uma configuração alternativa do Atlanta; não há suporte a uma subdivisão estável em múltiplos grupos. Não interpretar os clusters como categorias reais de partidas ou o ruído como erro de coleta.

Para atualizar deliberadamente a revisão compacta após `make data-anomalies`, executar o [exportador](../../backend/scripts/export_sensitivity_review.py):

```bash
uv run --locked python -m backend.scripts.export_sensitivity_review
```

Ele confere status, fonte atual e configuração antes de escrever o relatório versionável. A geração normal de anomalias não modifica a documentação.

## Resultados e validação em 29/10/2026

São 50 resultados: 3 métodos univariados × 7 variáveis × 2 times, mais 4 multivariados × 2 times. Cada ajuste usa 75 registros do Atlanta ou 74 do Houston. A coincidência de quantidades entre métodos não significa que sinalizaram as mesmas partidas.

| Variável | IQR Atlanta | IQR Houston | Z-score Atlanta | Z-score Houston |
| --- | --- | --- | --- | --- |
| PTS | 2 | 0 | 0 | 0 |
| REB | 1 | 0 | 0 | 0 |
| AST | 2 | 0 | 0 | 0 |
| STL | 1 | 2 | 1 | 0 |
| BLK | 0 | 0 | 0 | 1 |
| PF | 0 | 0 | 0 | 0 |
| FG3M | 3 | 0 | 0 | 0 |

Grubbs não rejeitou a hipótese nula em nenhuma das 14 análises nominais do dataset. ECOD, k-NN e LOF sinalizaram quatro partidas por time no corte escolhido; DBSCAN sinalizou 4/2 conforme acima. As listas e os parâmetros completos estão em anomalies.json; nenhuma partida foi removida.

`make check`: **151 testes aprovados**, Ruff e formatação aprovados. Cobertura inclui exemplo numérico Grubbs do NIST, empates ambíguos, constante, amostra insuficiente, exclusão do próprio vizinho, permutação, empates no corte, equivalência IQR/boxplot, escala/constantes, LOF histórico, DBSCAN todo/nenhum ruído, oráculo ECOD e invalidação após falha de entrada.

R14, R15 e R23 continuam parciais: a ciência está implementada, mas apresentação/interpretação dentro do sistema e contratos da API pertencem às próximas etapas.
