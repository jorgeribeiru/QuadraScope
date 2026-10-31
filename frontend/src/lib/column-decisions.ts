// Complemento editorial da seleção existente; não modifica o dicionário científico.
export const columnDecisions: Record<string, string> = {
  Team_ID:
    'Usamos o código para identificar o time. Mantivemos esse campo fora das distâncias entre desempenhos.',
  Game_ID:
    'Usamos o identificador para parear as duas linhas de cada partida e conferir os registros.',
  GAME_DATE:
    'Utilizamos a data para ordenar as partidas e filtrar os períodos. Não incluímos a data bruta nas distâncias entre desempenhos.',
  MATCHUP: 'Usamos o confronto para identificar o adversário e extrair o mando da partida.',
  TEAM_NAME:
    'Mantivemos o nome para apresentar o time nas consultas; a identificação dos registros é feita pelo código.',
  WL: 'Usamos o resultado para filtrar vitórias e derrotas. Em uma previsão pré-jogo, esse resultado ainda não estaria disponível.',
  W: 'Conferimos as vitórias acumuladas para verificar o histórico. Na análise por partida, usamos as estatísticas daquele jogo.',
  L: 'Usamos as derrotas acumuladas na verificação do histórico. Em uma previsão pré-jogo, precisaríamos usar o acumulado anterior à partida.',
  W_PCT:
    'Conferimos a razão W/(W+L) a partir dos acumulados. Para o aproveitamento de um recorte, usamos as vitórias e os jogos selecionados.',
  MIN: 'Usamos os minutos agregados para identificar e contextualizar as prorrogações. Mantivemos os totais por partida na análise principal.',
  FGM: 'Mantivemos as cestas de quadra para conferir a composição dos pontos. Escolhemos as sete variáveis do enunciado para a análise principal.',
  FGA: 'Preservamos as tentativas de quadra para conferir o aproveitamento e permitir outras análises. Neste trabalho, priorizamos as sete variáveis pedidas.',
  FG_PCT:
    'Verificamos a razão FGM/FGA respeitando o arredondamento da fonte. Mantivemos esse percentual como informação auxiliar.',
  FG3A: 'Mantivemos as tentativas de três como contexto. Na análise principal, usamos FG3M para representar o volume convertido.',
  FG3_PCT:
    'Conferimos o aproveitamento FG3M/FG3A e o preservamos como informação auxiliar. Para o conjunto principal, escolhemos o volume convertido.',
  FTM: 'Usamos os lances livres convertidos para conferir a pontuação. Na análise principal, trabalhamos com PTS e as outras seis variáveis pedidas.',
  FTA: 'Preservamos as tentativas de lances livres para conferir os percentuais e permitir outras análises de aproveitamento.',
  FT_PCT:
    'Conferimos a razão FTM/FTA e seu arredondamento. Mantivemos esse percentual fora do conjunto principal de contagens.',
  OREB: 'Escolhemos REB para representar o total de rebotes. Preservamos os componentes para conferência, considerando a relação REB=OREB+DREB.',
  DREB: 'Usamos o total de rebotes na análise principal e mantivemos os rebotes defensivos para conferir a soma e apoiar outras análises.',
  TOV: 'Preservamos os desperdícios de posse na base. Eles ficaram fora da análise principal, que segue as sete variáveis do enunciado.',
}
