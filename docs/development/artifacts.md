# Artefatos reproduzíveis — etapa 6

O pipeline completo transforma um snapshot aprovado em um release identificado por SHA-256. Ele reutiliza ingestão, qualidade, descritivas, distribuições, detectores e sensibilidade das etapas anteriores. O CSV original permanece preservado. API e interface serão implementadas nas próximas etapas.

## Executar

Da raiz do projeto, com Python 3.12 e uv:

```bash
make setup
make data-build
make data-validate
make data-reproduce
make data-package-runtime
```

Sem Make, usar `uv run --locked python -m backend.scripts.build_data` seguido de `build`, `validate`, `reproduce` ou `package-runtime`. Os comandos terminam com código diferente de zero se a fonte, os parâmetros ou os artefatos forem inválidos.

`data-build` executa todas as análises a partir da mesma leitura do CSV; não exige executar previamente os comandos das etapas 2–5. Esses comandos continuam disponíveis para diagnóstico intermediário. A futura API consome o release apontado por `current.json`, em vez de combinar saídas intermediárias de execuções diferentes.

## Estrutura e contratos

```text
data/processed/
├── current.json                    # ID do release e hash do manifesto
├── releases/<release_id>/
│   ├── manifest.json
│   ├── canonical.parquet           # 2.238 × 28
│   ├── games.parquet               # 2.238 × 33, contexto enriquecido
│   ├── focus.parquet               # 149 × 33, Atlanta/Houston
│   ├── games.json                  # todas as linhas enriquecidas
│   ├── descriptives.json           # 14 pares variável/time
│   ├── distributions.json          # histogramas/KDE das sete variáveis
│   ├── comparisons.json            # CV/IQR 7×2, quartis e resumo
│   ├── quality.json                # auditoria, cobertura e missingness
│   ├── anomalies.json              # 50 resultados, registros e resumo
│   ├── sensitivity.json            # 44 variantes e seleção
│   ├── dictionary.json             # registro das 28 colunas
│   ├── content.json                # proveniência, métodos e licença
│   └── schemas.json                # JSON Schemas dos contratos
├── reproducibility.json            # evidência de dois builds independentes
└── runtime/                        # pacote exportado para a futura API
    ├── current.json
    └── releases/<release_id>/       # manifesto + os dez JSONs acima
```

São **13 artefatos**, além do manifesto. As pastas geradas são ignoradas pelo Git e reconstruídas pelos comandos acima. Os contratos Pydantic estão versionados em [models.py](../../backend/artifacts/models.py), com schema `1.0.0`; `schemas.json` exporta também os contratos de linha, manifesto e ponteiro. Alterações incompatíveis exigem revisão de versão e do leitor.

Os JSONs usam UTF-8, chaves ordenadas, números finitos e datas civis ISO `YYYY-MM-DD`. Contagens não aceitam booleanos ou strings numéricas; campos inesperados e chaves JSON repetidas são rejeitados. Medidas indefinidas mantêm `null`, estado e motivo. Na base aprovada atual, linhas canônicas/enriquecidas não admitem valores ausentes; o Parquet usa schema físico explícito, inclusive `date32` e IDs textuais.

`content.json` preserva as limitações da coleta e a teoria de missingness, sem inventar data de extração ou execução de testes. As interpretações continuam vazias com `interpretation_status=pending_stage_9`: sua redação e apresentação pertencem à etapa 9.

## Manifesto e reprodução

O manifesto registra:

- SHA-256, bytes, dimensões e formato da fonte;
- versões de schema/análise, parâmetros revisados e ordem das sete features;
- commit Git, estado de alterações locais e hashes individuais do código Python, conteúdo, fixtures, licença, configuração de dependências e lock;
- versões das dependências diretas utilizadas, ambiente Python/plataforma e limite de uma thread numérica;
- nome, tamanho, hash, schema, formato e participação no runtime de cada artefato;
- data UTC de geração e política de dependências do runtime.

O hash agregado dos arquivos de código identifica também builds com alterações ainda sem commit. Em cópia sem Git, commit/estado são `null`, mantendo os hashes de conteúdo. O lock e os exports com hashes fixam as dependências transitivas.

`release_id` é o SHA-256 da representação canônica do manifesto, excluindo somente o próprio ID e `generated_at`. Todos os hashes das saídas participam dessa identidade. Uma segunda publicação idêntica reutiliza o release validado existente e preserva seu manifesto e timestamp originais.

`make data-reproduce` executa duas computações independentes, sem publicar o ponteiro, e compara os hashes de **todos os 13 artefatos**, inclusive Parquet, e os demais campos do manifesto. Só o horário de geração é excluído. O relatório local registra os dois horários, o hash da fonte e a identidade do código. A verificação comprova repetibilidade no ambiente registrado; não promete igualdade binária entre versões diferentes de bibliotecas, sistemas ou arquiteturas.

## Validação e publicação

O build grava em diretório temporário dentro da saída, valida o conjunto e só então o move para `releases/<release_id>`. A troca de `current.json` usa arquivo temporário, flush/fsync do arquivo e `os.replace` no mesmo sistema de arquivos. Leitores enxergam um ponteiro completo. Releases anteriores não são removidos nem sobrescritos.

Antes da promoção são verificados hashes/tamanhos, schemas, valores finitos, metadados comuns, completude dos arquivos, pareamento e contexto dos jogos, contagens, histogramas, tabelas, quartis, boxplots, flags/referência dos detectores e sensibilidade. Os três Parquets devem coincidir com as linhas JSON e seus schemas físicos. A fonte e a identidade do código são conferidas novamente ao terminar o cálculo.

Uma falha no cálculo, na validação ou na escrita do ponteiro mantém a publicação anterior. Se a escrita do ponteiro falhar depois da promoção, pode existir um release completo sem referência; ele não será apresentado como atual. Esse mecanismo fornece publicação atômica local; não é uma garantia de durabilidade de todos os arquivos diante de perda de energia.

`make data-validate` relê o ponteiro e valida o release completo. O leitor rejeita arquivos ausentes, adulterados ou incompatíveis; não combina releases nem fabrica resultados. Na etapa 7, a API traduzirá essas falhas de infraestrutura em respostas adequadas. Para recuperar uma publicação corrompida, restaurar um pacote completo validado ou reconstruir pelo comando de build; o pipeline não sobrescreve silenciosamente um release existente corrompido.

## Runtime e cálculos online

| Uso | Artefatos/dependências |
| --- | --- |
| Pipeline offline | CSV, três Parquets, dez JSONs; pandas, NumPy, SciPy, PyArrow, scikit-learn, threadpoolctl e Pydantic |
| Futura API | `runtime/current.json`, manifesto e dez JSONs; FastAPI/Uvicorn/Pydantic, pandas/NumPy/SciPy |
| Desenvolvimento | Grupos `dev` e `pipeline` ativados por padrão no uv |

`make data-package-runtime` exporta e valida o subconjunto JSON com a mesma identidade e manifesto do release. O manifesto mantém o inventário completo para rastreabilidade, mas o perfil `runtime` exige somente as entradas marcadas para runtime. Ele dispensa CSV, Parquet, PyArrow, scikit-learn e threadpoolctl.

O [ArtifactRepository](../../backend/repositories/artifacts.py) lê esse pacote sem importar o pipeline, valida-o ao carregar e devolve cópias dos documentos:

```python
from backend.app.config import settings
from backend.repositories.artifacts import ArtifactRepository

repository = ArtifactRepository(settings.runtime_package_dir)
games = repository.get("games.json")["rows"]
```

As futuras descritivas e distribuições filtradas reutilizam `descriptive_reports` sobre `games.json`, com pandas/NumPy/SciPy. Converter as datas ISO em datas civis na fronteira de leitura; não usar inferência Arrow como requisito do runtime. Os detectores permanecem ajustados ao histórico completo de cada time e serão filtrados apenas na exibição. Não recalcular scikit-learn online. Latência, memória e tamanho do deploy serão medidos na etapa 8.

`requirements.txt` exporta runtime + pipeline, sem ferramentas dev. `requirements-runtime.txt` exporta somente as dependências da futura API, também com hashes. Para instalar o segundo em ambiente isolado:

```bash
uv venv --python 3.12 /tmp/quadrascope-runtime
uv pip sync --python /tmp/quadrascope-runtime/bin/python --require-hashes requirements-runtime.txt
```

Usar o fluxo normal `make setup` para desenvolvimento. `make check-env` verifica o ambiente completo do projeto e requer o grupo pipeline. O pacote JSON e os módulos Python de runtime precisarão ser incluídos no deploy; o comando de exportação não cria servidor nem configura hospedagem.

## Evidências de validação

Os [testes de artefatos](../../backend/tests/analytics/test_artifacts.py) cobrem publicação/reuso, duas computações independentes, fonte inválida, staging incompleto, falha de escrita do ponteiro, arquivos ausentes, adulterações com hashes recalculados, incompatibilidade de versões, caminhos inválidos e pacote sem CSV/Parquet. As fórmulas continuam verificadas pelas suítes científicas anteriores.

Em 29/10/2026, `make check` aprovou 171 testes e Ruff/formatação. Build, validação, reprodução de 13 artefatos e exportação runtime aprovados. Em ambiente uv isolado, o pacote gerou 14 descritivas e distribuições das sete variáveis filtradas por mando: Atlanta com 38 jogos em casa (média PTS 118,10526315789474) e Houston com 35 (113,11428571428571), sem CSV ou Parquet. Evidências locais: `data/processed/reproducibility.json` e `data/processed/runtime-verification.json`; geradas e ignoradas pelo Git.
