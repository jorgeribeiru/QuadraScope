# Ingestão e normalização — etapa 2

## Executar

Com o ambiente da [etapa 1](setup.md) instalado, executar da raiz:

```bash
make data-normalize
```

Equivalente somente com uv:

```bash
uv run --locked python -m backend.scripts.normalize_data
```

A entrada é `data/raw/stats_times_regular_final.csv`. O comando confere o SHA-256 contra a identidade registrada em `backend/app/config.py` e na [proveniência](../data/provenance.md). Uma origem diferente interrompe a execução, sem escrever novos intermediários. Não atualizar o hash só para ignorar uma divergência: uma nova versão da base exige verificar a origem e atualizar explicitamente sua documentação.

## Saídas intermediárias

```text
data/processed/ingestion/
├── canonical.parquet    # 30 times, 2.238 linhas e 28 colunas canônicas
├── focus.parquet        # Atlanta/Houston, 149 linhas e as mesmas 28 colunas
└── ingestion.json       # Identificação, tipos, mapeamento, recorte e políticas
```

Os arquivos são locais e ignorados pelo Git. A execução repetida substitui esses intermediários, sem alterar o CSV. Os Parquets são preparados antes de substituir as saídas e o relatório é escrito por último; isso não representa publicação transacional dos artefatos finais. Não consumir esses arquivos como resultados científicos aprovados.

O relatório contém o status `normalized_pending_quality_validation`, SHA-256, bytes, codificação, delimitador, dimensões, tipos efetivos, contagens por time, ordem das features e dicionário executável. Não inclui uma data de extração inferida ou resultados de testes de qualidade ainda não executados. O manifesto completo de publicação pertence à etapa 6.

## Contrato de leitura

- Ler um único snapshot dos bytes para que a identificação e o parsing se refiram à mesma entrada.
- Exigir UTF-8, aceitando BOM; delimitador vírgula e estrutura CSV válida. Verificar as 28 colunas, nomes duplicados, extras/faltantes e largura de cada registro antes de converter valores.
- Aceitar colunas em outra ordem, mas normalizar a saída na ordem do dicionário. Não aceitar renomeações desconhecidas.
- Preservar IDs como strings de dígitos, incluindo zeros à esquerda se presentes; não restaurar zeros por suposição. ID vazio é erro.
- Converter apenas células vazias em ausências; não converter automaticamente textos como `NA`/`NULL` em missing. Ausências de campos não identificadores permanecem representadas em tipos anuláveis para auditoria na etapa 3. Não imputar.
- Rejeitar espaços externos e valores incompatíveis com o tipo, sem strip, truncamento ou conversão silenciosa para missing.
- Exigir contagens inteiras não negativas que caibam em Int64. W/L já são numéricos neste CSV: não há codificação categórica inventada.
- Validar WL como 0/1 antes de converter para booleano anulável. Frações devem ser numéricas, finitas e estar em [0,1], sem arredondamento antecipado.
- Validar data real no formato exato YYYY-MM-DD; preservar a data civil em `date32[day][pyarrow]`, inclusive no Parquet, sem timezone.
- Ordenar por time, data e ID de partida, com índice posicional reiniciado. Nenhuma duplicata, observação extrema ou valor zero é removido.

O domínio básico de tipos é validado aqui. Contagens detalhadas, duplicatas, relações, pareamento e cobertura são executados separadamente por [make data-quality](quality.md), implementado na etapa 3. Preservar uma célula ausente não significa aprová-la para análise.

## Componentes e uso programático

| Arquivo | Responsabilidade |
| --- | --- |
| [config.py](../../backend/app/config.py) | Entrada, saída, hash esperado, IDs, métricas e versões |
| [metrics.py](../../backend/analytics/metrics.py) | Registro imutável das 28 colunas, rótulos, tipos, unidades, domínios, papéis e exclusões |
| [ingestion.py](../../backend/analytics/ingestion.py) | Snapshot, conversões, ordenação, recorte e seleção das features |
| [normalize_data.py](../../backend/scripts/normalize_data.py) | Comando de geração dos intermediários |
| [test_ingestion.py](../../backend/tests/analytics/test_ingestion.py) | Contratos, entradas inválidas, preservação e roundtrip Parquet |

`ingest()` retorna a base canônica, o recorte e a matriz de features em memória, além dos metadados. A matriz tem 149 linhas e sete colunas na ordem PTS, REB, AST, STL, BLK, PF, FG3M. Seus índices correspondem ao recorte, que mantém os IDs; não usar ID, resultado ou acumulados como features. Cada coluna excluída tem motivo no registro. Não há ajuste de detector ou imputação nesta etapa.

`read_source(path)` pode ser usado em testes com entradas isoladas; o fluxo oficial `ingest()` sempre confere o hash esperado da configuração. Os detalhes de parsing foram conferidos com a documentação primária do [pandas: leitura](https://pandas.pydata.org/docs/reference/api/pandas.read_csv.html), [datas](https://pandas.pydata.org/docs/reference/api/pandas.to_datetime.html) e [Parquet](https://pandas.pydata.org/docs/reference/api/pandas.DataFrame.to_parquet.html). A leitura estrutural usa `csv` da biblioteca padrão, preservando os literais antes da conversão pandas.

## Verificar

```bash
make check
uv run --locked pytest -m analytics
```

Os testes cobrem schema inválido, registro malformado, IDs com zeros à esquerda, literal NA, WL fora do domínio, datas inválidas, frações/contagens inválidas, overflow, ausências preservadas, ordenação, recorte, exclusões, roundtrip, execução repetida e proteção da origem. A integração com o CSV confere 2.238×28, 30 times, 149×7 features e 75/74 jogos do grupo.

`make data-quality` audita e enriquece a fonte separadamente, sem promover silenciosamente o status destes intermediários de normalização. `make data-build` permanece indisponível: normalização e qualidade são apenas os primeiros segmentos do pipeline. API, interface e cálculos estatísticos ainda não foram implementados. Os requisitos R07–R10 permanecem parciais até a apresentação no sistema.
