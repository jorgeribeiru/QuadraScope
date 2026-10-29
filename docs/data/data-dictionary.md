# Dicionário e transformações — QuadraScope

> Normalização das 28 colunas implementada na etapa 2. Registro executável em [metrics.py](../../backend/analytics/metrics.py); execução e contratos no [guia de ingestão](../development/ingestion.md).

Dados brutos: [CSV original](../../data/raw/stats_times_regular_final.csv). Origem e limitações de coleta: [proveniência](provenance.md).

Uma linha representa um time em uma partida. IDs são texto mesmo que contenham somente dígitos. Nomes canônicos serão usados internamente; a UI usa rótulos em português. Conservar mapeamento para os nomes originais. Os parâmetros públicos `metric`/`features` aceitam as siglas originais por allowlist e as resolvem pelo registro de métricas.

Legenda de uso: **principal** = vetor obrigatório das sete variáveis; **contexto** = qualidade, identificação ou explicação; **auxiliar** = potencial análise futura, fora do vetor principal. Tipo indica o destino normalizado.

| Original | Canônico | Tipo | Significado / unidade | Uso |
| --- | --- | --- | --- | --- |
| Team_ID | team_id | string | Identificador do time | Contexto; chave, não magnitude |
| Game_ID | game_id | string | Identificador da partida | Contexto; parte da chave |
| GAME_DATE | game_date | date | Data civil da partida | Contexto/filtro; série temporal futura |
| MATCHUP | matchup | string | Descrição de adversário e mando | Contexto; parsing e auditoria |
| WL | won | boolean | 1=vitória, 0=derrota | Contexto/filtro; resultado pós-jogo |
| W | cumulative_wins | integer | Vitórias acumuladas após o jogo | Contexto; validação do histórico |
| L | cumulative_losses | integer | Derrotas acumuladas após o jogo | Contexto; validação do histórico |
| W_PCT | cumulative_win_rate | float | W/(W+L), fração [0,1] | Contexto; não é win rate do filtro |
| MIN | team_minutes | integer | Minutos agregados dos jogadores | Contexto; prorrogação e exposição |
| FGM | field_goals_made | integer | Cestas de quadra convertidas, incluindo três pontos | Auxiliar; identidade de pontos |
| FGA | field_goals_attempted | integer | Arremessos de quadra tentados | Auxiliar; denominador de FG_PCT |
| FG_PCT | field_goal_rate | float | FGM/FGA, fração [0,1] | Auxiliar; qualidade e arredondamento |
| FG3M | three_pointers_made | integer | Cestas de três convertidas / jogo | Principal |
| FG3A | three_pointers_attempted | integer | Arremessos de três tentados | Auxiliar |
| FG3_PCT | three_point_rate | float | FG3M/FG3A, fração [0,1] | Auxiliar |
| FTM | free_throws_made | integer | Lances livres convertidos | Auxiliar; identidade de pontos |
| FTA | free_throws_attempted | integer | Lances livres tentados | Auxiliar |
| FT_PCT | free_throw_rate | float | FTM/FTA, fração [0,1] | Auxiliar |
| OREB | offensive_rebounds | integer | Rebotes ofensivos | Auxiliar; componente de REB |
| DREB | defensive_rebounds | integer | Rebotes defensivos | Auxiliar; componente de REB |
| REB | rebounds | integer | Rebotes totais / jogo | Principal |
| AST | assists | integer | Assistências / jogo | Principal |
| STL | steals | integer | Roubos de bola / jogo | Principal |
| BLK | blocks | integer | Tocos / jogo | Principal |
| TOV | turnovers | integer | Desperdícios de posse / jogo | Auxiliar |
| PF | personal_fouls | integer | Faltas pessoais / jogo | Principal |
| PTS | points | integer | Pontos / jogo | Principal |
| TEAM_NAME | team_name | string | Nome do time | Contexto; apresentação |

## Transformações implementadas

- Ler IDs como strings, sem adicionar zeros por suposição. Não converter IDs para floats.
- Converter GAME_DATE estritamente; falhas são reportadas e bloqueiam o artefato.
- W e L **já são numéricos neste CSV**. Validar inteiro não negativo; não inventar uma conversão categórica para cumprir o exemplo do enunciado.
- WL **já é 0/1**. Validar o domínio antes de converter para booleano; não usar cast que transforma qualquer número não zero em vitória.
- Preservar percentuais como frações. O frontend pode exibir 0,56 como 56%, identificando a unidade.
- Não preencher ausências, remover zeros ou excluir partidas por serem atípicas.
- Ordenar por time, data e ID de partida para análises sequenciais. A ordenação original do CSV não define sequência temporal.
- Preservar CSV original e seus 28 campos na base canônica. Dados derivados têm nomes e proveniência próprios.

## Campos derivados implementados na etapa 3

| Campo | Derivação | Uso e limitação |
| --- | --- | --- |
| opponent_id | Outra linha do mesmo game_id | Requer pareamento validado antes do recorte |
| opponent_points | PTS do adversário pareado | Contexto do placar |
| point_margin | points − opponent_points | Saldo; auxiliar, fora do vetor principal |
| venue | vs.=home; @=away | Conferir contra a outra linha; não inferir de posição no CSV |
| overtime_periods | (team_minutes−240)/25 | Somente após validar domínio 240+25k, k inteiro não negativo |
| win_rate | Vitórias / n no filtro | Não confundir com cumulative_win_rate |

Os cinco campos de partida são gerados por `make data-quality` apenas após aprovação da auditoria. `win_rate` pertence ao resumo de cobertura, não é uma coluna repetida por partida. Ver [qualidade e enriquecimento](../development/quality.md).

MIN=240 corresponde a 5 jogadores × 48 minutos; 25 minutos agregados adicionais são compatíveis com uma prorrogação de cinco minutos. Essa interpretação é apoiada pelo padrão interno, mas a definição da fonte ainda precisa ser documentada.

## Exclusões e prevenção de vazamento

O vetor multivariado principal contém somente PTS, REB, AST, STL, BLK, PF e FG3M. Excluir IDs, textos, datas brutas, resultado e acumulados porque não representam o perfil estatístico escolhido. Excluir as variáveis auxiliares para manter escopo e evitar redundância, como REB junto de OREB+DREB. Isso é seleção de features, não apagamento da base.

Não existe modelo preditivo nesta entrega. Se futuramente a tarefa for prever vitória antes do jogo, os totais e o resultado desse mesmo jogo não podem ser features; acumulados pós-jogo exigiriam defasagem. Escolhas definitivas dependem do alvo e do instante de previsão.

O sistema deverá publicar este dicionário, os tipos de origem/destino e as decisões de transformação em `/dados`, além de retorná-los pela API. Este arquivo sozinho não cumpre a exigência de apresentação no sistema.
