# Qualidade e enriquecimento — etapa 3

## Executar

Da raiz, com o ambiente instalado:

```bash
make data-quality
make check
```

Equivalente somente uv:

```bash
uv run --locked python -m backend.scripts.audit_data
```

O comando relê o CSV bruto, confere sua identidade e executa a normalização da etapa 2 antes de auditar. Não confia em Parquets antigos. Nenhum dado bruto é alterado. A qualidade completa desta etapa se refere às regras internas implementadas; não comprova autenticidade externa ou calendário completo.

## Saídas e bloqueios

```text
data/processed/quality/
├── quality.json                  # Diagnóstico e metadados da fonte
├── canonical_enriched.parquet    # Somente quando status=passed: 2.238×33
└── focus_enriched.parquet        # Somente quando status=passed: 149×33
```

`quality.json` identifica versões, fonte, status, regras bloqueantes, exemplos dos registros afetados, avisos, tabelas por coluna, cobertura e aplicabilidade de missingness. Base completa e recorte do grupo têm perfis por coluna separados. Arquivos locais ficam ignorados pelo Git.

Se houver erro de schema, hash, parsing, domínio, ausência ou consistência, o status é `blocked`, o comando termina com código diferente de zero e não disponibiliza os Parquets enriquecidos. Arquivos enriquecidos de execução anterior também são removidos para evitar uso de resultados obsoletos. O diagnóstico bloqueado é preservado. Quando a ingestão falha antes da auditoria, o relatório registra essa falha; não inventa contagens de regras que não puderam ser executadas.

Uma falha de escrita/leitura de infraestrutura produz erro do comando; a publicação transacional final e sua política de consumo permanecem na etapa 6. Esses arquivos são intermediários locais de qualidade, não o conjunto final de publicação das análises.

## Regras por coluna

Cada uma das 28 colunas recebe n, missing, zeros, negativos e fora de domínio. Medidas sem significado para o tipo recebem `null`: por exemplo, contar zeros em IDs não é contar desempenhos nulos. WL tem contagem de zeros correspondente a derrotas, sem tratar a categoria como magnitude contínua.

Todas as células precisam estar presentes e dentro do domínio para liberar análise. A etapa 2 preserva ausências, enquanto esta etapa as registra e bloqueia, sem imputação. Tipos inválidos podem ser rejeitados já na ingestão. Zeros não são erros por si só.

Outliers têm contagem `null` e estado `not_evaluated` para grandezas numéricas, pois os detectores pertencem às etapas 4–5. IDs/texto/datas/categorias recebem `not_applicable`. Não apresentar “zero outliers” quando nenhum método foi executado.

## Consistência entre registros e campos

| Grupo | Regras |
| --- | --- |
| Identificação | Duplicatas de linha e da chave time-partida; um nome por ID, um ID por nome e sigla consistente no próprio dataset |
| Contagens | Inteiros não negativos; percentuais finitos em [0,1]; convertidos ≤ tentados; FG3M ≤ FGM; FG3A ≤ FGA |
| Identidades | 2×FGM + FG3M + FTM = PTS; OREB + DREB = REB |
| Percentuais | Conferir razão com tolerância absoluta 0,00050001 para arredondamento a três casas |
| Tempo | MIN = 240 + 25×k, k inteiro não negativo; adversários com minutos iguais |
| Partida | Exatamente duas linhas com times distintos; mesma data; uma vitória/uma derrota; sem empate; WL coerente com os pontos |
| Matchup | Parsing SIGLA vs./@ SIGLA; siglas recíprocas e um time em casa/outro fora |
| Acumulados | W+L positivo; W_PCT compatível com W/(W+L); evolução coerente com os resultados e possíveis lacunas de cobertura |

Percentual com tentativas zero é razão indefinida. Não dividir por zero nem substituir o percentual da fonte: registrar aviso e não avaliar essa identidade naquele registro. Convertidos maiores que zero com tentativas zero continuam sendo inconsistência bloqueante.

Duplicatas são apresentadas como excesso de linhas e também como número de registros afetados. Duplicatas e cardinalidade inválida impedem o pareamento; não gerar produto cartesiano. Pareamento usa chave de partida e lado, com merge 1:1, antes de recortar os dois times.

## Campos derivados e cobertura

As 28 colunas canônicas permanecem presentes. São acrescentadas:

| Campo | Derivação |
| --- | --- |
| opponent_id | ID da outra linha da partida |
| opponent_points | Pontos do adversário |
| point_margin | Pontos do time − pontos do adversário |
| venue | vs.=home; @=away |
| overtime_periods | (MIN−240)/25, após verificar o domínio |

Win rate do recorte é calculado no resumo, `vitórias/n`, sem replicar a proporção em todas as linhas. Não é média de W_PCT.

A cobertura identifica período, linhas, partidas distintas, vitórias/derrotas, mando, prorrogações e estatísticas por time. Nas contagens globais, a unidade importa: 102 registros de time-partida com prorrogação correspondem a 51 jogos únicos, não 102 jogos.

Se a primeira observação de um time já tem W+L>1, ou há salto maior que um entre observações, registrar jogos não observados inferidos dos acumulados como aviso de cobertura. Isso não é missing em células. Reduções dos acumulados e incrementos incompatíveis com resultados são bloqueantes. Quando o histórico começa no primeiro jogo, conferir também seu resultado inicial. Não declarar lacunas a partir da diferença entre a última data e a data atual.

## Missingness: aplicação e conteúdo

[missingness.json](../../backend/content/missingness.json) contém definições de MCAR/MAR/MNAR e explicações de Little, Jamshidian–Jalal, Listing–Schlittgen e Fairclough: teoria, motivo de uso, pressupostos e limitações. [missingness.py](../../backend/analytics/missingness.py) combina esse conteúdo com as ausências observadas.

- Sem missing, sem observações ou com indicadores constantes: `not_applicable`, com motivo.
- Indicadores com variação: `requires_methodological_review`; não há implementação inferencial automática desses testes.
- Em ambos os casos: `executed=false`, `statistic=null` e `p_value=null`.

Na base real não há missing, portanto nenhum teste foi executado. O mecanismo permanece `not_identified`; não se conclui MCAR. Não rejeitar MCAR também não o comprova, e MAR/MNAR exigem hipóteses adicionais. Formulações longitudinais não se transferem automaticamente para linhas time-partida. Referências: [mice — Jamshidian–Jalal](https://amices.org/mice/reference/mcar.html), [estudo comparativo](https://link.springer.com/article/10.1186/1477-7525-7-57).

## Resultado da base fornecida em 29/10/2026

- 2.238 registros, 30 times, 1.119 partidas; 64 regras/checagens no relatório da base atual, sem falhas bloqueantes.
- Zero missing, duplicatas ou violações nas regras de domínio e consistência implementadas.
- Avisos legítimos: 33 registros com zero tocos, um com zero roubos e 102 com prorrogação (51 partidas).
- Atlanta: 75 jogos, 42 vitórias, 38 em casa/37 fora, dois com prorrogação.
- Houston: 74 jogos, 45 vitórias, 35 em casa/39 fora, oito com prorrogação.
- Recorte: 149 registros, 147 partidas distintas e dois confrontos diretos.

Os testes cobrem erros de domínio/data, ausências, duplicatas, adversário ausente, placar/resultado, mando, percentuais, denominador zero, acumulados, preservação dos campos e falhas posteriores a uma execução aprovada. Evidência executável: [test_quality.py](../../backend/tests/analytics/test_quality.py).

Requisitos R08 e R11–R14 continuam parciais: esta etapa prepara resultados e conteúdo; sua apresentação no sistema e os detectores de outliers pertencem às próximas etapas.
