# Proveniência do dataset

> Origem informada pelo grupo em 29/10/2026. Esta data registra a confirmação, não a data da extração.

## Origem e coleta

Segundo a informação fornecida pelo grupo, o arquivo contém **dados reais da temporada regular 2025–26 da NBA por time**, obtidos da **API oficial da NBA, no domínio nba.com**, por meio da biblioteca **`nba_api` em Python**.

Essa declaração documenta a origem comunicada pelo grupo. Não constitui uma nova extração nem uma verificação externa de cada partida. O grupo não forneceu nesta confirmação o endpoint específico, os parâmetros, a versão da biblioteca ou o script de coleta; não inferir essas informações a partir do nome do CSV.

## Identificação do arquivo preservado

| Campo | Valor |
| --- | --- |
| Arquivo | [stats_times_regular_final.csv](../../data/raw/stats_times_regular_final.csv) |
| Temporada declarada | NBA 2025–26, temporada regular |
| Granularidade | Um time em uma partida |
| Cobertura observada | 21/10/2025 a 29/03/2026 |
| Dimensões | 2.238 linhas, 28 colunas, 30 times, 1.119 partidas |
| Recorte do grupo | Atlanta: 75 jogos; Houston: 74 jogos |
| Tamanho | 309.357 bytes |
| SHA-256 | `fa56bf638ef18be972a88850719043953e615bf39339671a8daa007ba08811b6` |
| Confirmação da origem | Grupo, em 29/10/2026, durante a revisão do planejamento |

A reorganização do repositório apenas mudou a localização do CSV para `data/raw/`; os bytes foram preservados. Essa pasta é a fonte canônica dos dados brutos, compartilhada pelo futuro pipeline e backend. Dados processados serão gerados separadamente em `data/processed/`.

## Informações ainda não fornecidas

- Data e horário exatos da extração.
- Endpoint(s), parâmetros e paginação ou filtros de coleta.
- Versão de `nba_api` e ambiente de execução da coleta.
- Script original e eventuais tratamentos anteriores à entrega do CSV.

Esses campos ficam registrados como **não informados**, não como ausentes no dataset nem como evidência de dados sintéticos. O período dos jogos e as datas de modificação locais não substituem a data de extração.

P0.06 está concluído pela confirmação da origem e pelo registro explícito das limitações, conforme a alternativa prevista nessa tarefa. Uma reprodução exata da coleta depende dos detalhes acima; a reprodução das análises usará o CSV preservado e seu hash.

O sistema deverá apresentar esta proveniência e suas limitações na página de dados. A documentação preparatória ainda não conclui os requisitos de apresentação no sistema.
