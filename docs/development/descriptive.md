# Estatística descritiva e distribuições — etapa 4

## Executar

Com o ambiente instalado, executar da raiz:

```bash
make data-describe
make check
```

Equivalente somente uv:

```bash
uv run --locked python -m backend.scripts.describe_data
```

O comando lê um novo snapshot do CSV, confere o hash, normaliza e executa a auditoria da etapa 3 em memória. Só calcula descritivas após aprovação. Não depende de arquivos intermediários antigos e não altera o CSV ou o PDF.

## Arquivos gerados

```text
data/processed/descriptive/
├── status.json          # Identidade da fonte, versões, parâmetros e aprovação/bloqueio
├── descriptives.json    # 14 resultados: sete variáveis × dois times, medidas e boxplot
├── distributions.json  # Histogramas/KDE com bins e grades de comparação compartilhados
└── comparisons.json    # Quadros CV/IQR 7×2, Q1/Q3/IQR e tabela geral de medidas
```

São intermediários locais, ignorados pelo Git. O manifesto e a publicação finais continuam na etapa 6. Todos os resultados aprovados têm identidade da fonte, versões, população de referência, parâmetros e filtros. A execução padrão usa todo o histórico de cada time no dataset, sem filtros adicionais.

Se houver erro de entrada ou bloqueio da qualidade, `status.json` registra `blocked`, os três resultados anteriores são removidos e o comando termina com erro. Gravações são preparadas em diretório temporário e o status é substituído por último; publicação transacional final não está implementada nesta fase.

## Contrato por variável e time

Cada resultado identifica time, variável, unidade, n, período e avisos. Cada medida tem `value`, `status`, `reason`, `unit`, `method` e `parameters`. Valores indefinidos são `null`; a saída JSON rejeita NaN/infinito. Nenhuma observação é descartada silenciosamente para conseguir calcular uma medida.

| Grupo | Implementação |
| --- | --- |
| Centro | Média, mediana linear e todas as modas repetidas com frequência |
| Extremos | Mínimo, máximo e amplitude |
| Dispersão | Variância/desvio amostrais ddof=1; quartis lineares e IQR |
| CV | 100×desvio amostral/média; percentual, apenas em escala de razão e média positiva |
| Complemento robusto | IQR/mediana como fração, com mediana positiva; não é o CV amostral |
| Assimetria | SciPy skew com bias=False: Fisher–Pearson ajustado, direção e intensidade |

Estados por medida: `ok`, `empty`, `insufficient_sample`, `constant_series` ou `not_applicable`. Uma amostra com um jogo pode ter média e quartis válidos, mas não variância amostral ou CV. A assimetria ajustada exige n≥3 e variância positiva. Série constante positiva tem CV zero e assimetria indefinida; série de zeros não tem CV válido.

Modas aparecem em lista crescente. Se nenhum valor se repete, usar lista vazia, frequência 1 e motivo explícito; n=0 usa lista vazia/frequência 0. Não escolher arbitrariamente uma das modas.

Assimetria: sinal positivo=direita, negativo=esquerda, zero=neutra. Intensidade: |G1|<0,5 aproximadamente simétrica; 0,5≤|G1|<1 moderada; |G1|≥1 forte. Não é teste de normalidade ou evidência causal. Os parâmetros estão ligados à [metodologia](../data/methodology.md) e à [documentação SciPy](https://docs.scipy.org/doc/scipy/reference/generated/scipy.stats.skew.html).

## Boxplot e reutilização do IQR

[descriptive.py](../../backend/analytics/descriptive.py) calcula os quartis uma vez para cada resultado. Medidas, boxplot e tabelas compartilham esses valores. A função `iqr_limits` fica disponível para os detectores da etapa 5, evitando uma segunda convenção.

O payload inclui média, mediana, todas as modas, Q1, Q3, IQR, cercas teóricas e bigodes observados. Outliers usam desigualdade estrita fora de Q1−1,5×IQR e Q3+1,5×IQR; valor igual à cerca fica dentro. Cada registro sinalizado tem time, partida, data, matchup, valor e lado inferior/superior. Bigodes são as observações extremas ainda dentro das cercas.

Com IQR zero, manter a regra e exibir aviso; não substituir por outro método silenciosamente. Amostra vazia não produz quartis/bigodes fictícios. A identificação de outliers do boxplot está pronta; a suíte completa de detectores pertence à etapa 5.

## Histograma e KDE

[distributions.py](../../backend/analytics/distributions.py) combina os valores dos times selecionados para definir classes comuns por variável. Usa largura Freedman–Diaconis com quartis lineares. Com largura zero, usa Sturges como fallback. Para contagens, arredonda a largura para cima até inteiro ≥1 e alinha as bordas a meios inteiros, cobrindo todos os valores.

Há limite explícito de 256 classes; se necessário, aumentar a largura e registrar `resolution_capped=true`, sem remover extremos. O alinhamento pode modificar o número de classes sugerido pelo estimador. As contagens somam n e a densidade é contagem/(n×largura); histograma em densidade e KDE têm a mesma unidade inversa da variável.

KDE usa banda de Scott e 256 pontos em grade comum aos times com estimador válido, estendida por três bandas máximas além dos extremos combinados. Reportar fator, largura efetiva e probabilidade integrada na grade. Não renormalizar a grade finita nem cortar silenciosamente a cauda negativa do estimador. Contagens são discretas; a KDE é apenas uma suavização e pode atribuir densidade fora do domínio. Série constante e n<2 recebem estados explícitos sem curva inventada. Referências: [NumPy: estimadores de bins](https://numpy.org/doc/stable/reference/generated/numpy.histogram_bin_edges.html), [SciPy: KDE](https://docs.scipy.org/doc/scipy/reference/generated/scipy.stats.gaussian_kde.html).

## Comparações e API futura

[comparisons.py](../../backend/analytics/comparisons.py) produz resultados para os dois times, quadros 7×2 de CV/IQR, tabela Q1/Q3/IQR e resumo completo. As células preservam estado, unidade e n. Copiam as mesmas medidas já calculadas, sem novas fórmulas ou arredondamento.

Funções de cálculo não dependem de HTTP nem leem arquivos. `describe_team` e `descriptive_reports` podem receber um recorte selecionado e também representam seleções vazias. Na API futura, filtros e metadados devem ser atualizados junto com a população; o comando atual identifica apenas histórico completo. Cálculos científicos continuam no Python; a etapa React desenhará os gráficos.

## Verificações da etapa em 29/10/2026

- `make check`: 110 testes aprovados, Ruff e formatação aprovados.
- Valores manuais: amostras pequenas, modas empatadas, variância amostral, CV, quartis e assimetria de três pontos.
- Casos de borda: vazio, n=1/2, constante, média/mediana zero, ausência/NaN/infinito rejeitados, IQR zero e observação igual à cerca.
- Propriedades: mudança de escala, bins comuns, densidade do histograma com área 1, permutação de jogos e preservação de extremos sob limite de classes.
- Pipeline: identidade da fonte, JSON finito e invalidação de resultados anteriores após falha de hash/parsing/qualidade/arquivo ausente.

| Referência real | Atlanta | Houston |
| --- | --- | --- |
| Jogos | 75 | 74 |
| Média de pontos | 118,25333333333333 | 114,4054054054054 |
| CV de pontos (%) | 10,655066580171617 | 9,783714565619492 |
| IQR de pontos | 15,5 | 16,5 |
| Modas de pontos | 124 | 111, 117, 119, 124 |

Atlanta PTS: Q1=110,5; Q3=126; cercas 87,25 e 149,25. Outliers: 150 pontos no jogo 22500396 e 86 no jogo 22500682. Atlanta STL tem modas 9 e 11. Esses exemplos estão nos [testes científicos](../../backend/tests/analytics/test_descriptive.py); são calculados sem arredondamento intermediário.

API, frontend, interpretação visual e demais detectores não foram implementados nesta etapa. R16–R23 permanecem parciais até a entrega correspondente dentro do sistema.
