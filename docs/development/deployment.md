# Pacote e prova de hospedagem — etapa 8

A topologia preparada usa **uma origem**: FastAPI em `/api/v1`, React nos demais caminhos e assets estáticos. O pacote foi verificado localmente com as dependências reais de runtime. **Publicado e verificado em https://quadrascope.vercel.app** em 29/10/2026. P8.07 e P8.08 executados. A seção final registra tamanho, consultas e inicialização da aplicação em workers reais com instrumentação própria; o provisionamento completo da plataforma não foi isolado. O plano Hobby foi mantido. As seções anteriores preservam o histórico das tentativas de medição.

## Preparar o pacote

Com o ambiente Python e o frontend instalados:

```bash
make data-build
make web-build
make deploy-prepare
```

O empacotador [prepare_deployment.py](../../backend/scripts/prepare_deployment.py) valida o release atual e cria `.deployment/`, ignorado pelo Git. Entradas e saídas:

| Entrada | Saída no pacote |
| --- | --- |
| `frontend/dist/` | `web/`, incluindo fontes locais e licenças |
| Módulos Python de runtime selecionados | `backend/`, sem scripts, testes ou detectores offline |
| Release atual | `data/processed/current.json`, manifesto e dez JSONs de um único release |
| `requirements-runtime.txt` | `requirements.txt` com hashes e pyproject com todas as versões fixadas |
| [Templates de deploy](../../deployment/app.py) | `app.py` e `vercel.json` |
| Versão do Python | `.python-version` |

`package-manifest.json` registra hashes dos arquivos empacotados, release, tamanho da fonte e `cloud_verified=false`. O pacote não inclui CSV, Parquet, frontend/node_modules, PyArrow ou scikit-learn. Pacotes anteriores só são substituídos depois da validação da nova montagem; uma pasta de saída sem o marcador do empacotador não é apagada.

O `app.py` chama a mesma factory FastAPI, registra proteção para rotas `/api/*` desconhecidas e usa `app.frontend()` para a SPA. Assets têm mount próprio: um JS ausente retorna 404 e não HTML da aplicação. A navegação em `/times/1610612745?venue=home` retorna o index e permite que o React Router resolva a página. Os testes verificam esses comportamentos e preservam os dez endpoints OpenAPI.

## Decisão de topologia

O pacote propõe um único projeto FastAPI na Vercel, com build React feito antes do upload. Não depende da disponibilidade de Vercel Services beta, de um segundo backend ou de CORS entre duas origens. O `vercel.json` aponta o framework FastAPI e duração máxima de 60 segundos; o pyproject declara entrypoint e promoção dos assets para CDN. As rotas da API conservam seus controles no backend.

Essa decisão se apoia no suporte documentado a FastAPI com arquivos estáticos/frontends e na prova local do pacote. A primeira publicação confirmou essa topologia na Vercel, incluindo frontend no CDN, API Python e recarga profunda. Referências oficiais consultadas em 29/10/2026: [FastAPI e arquivos estáticos na Vercel](https://vercel.com/docs/frameworks/backend/fastapi), [runtime Python e limites](https://vercel.com/docs/functions/runtimes/python).

O limite padrão documentado da função Python é de 500 MB sem compressão. A estimativa local usa tamanho dos arquivos preparados mais site-packages do ambiente reduzido; ela não inclui todos os ajustes que o empacotador Vercel pode aplicar. A publicação foi aceita pelo empacotador da plataforma e testada em navegador. A API de inspeção informou output da função de 74.013.960 bytes; esse campo não é tratado como medição do tamanho completo sem compressão.

## Reproduzir a prova local

Instalar o runtime em um ambiente isolado. O caminho abaixo fica em dados processados ignorados; ele é usado apenas como ferramenta de validação:

```bash
uv venv --python 3.12 data/processed/tooling/runtime
uv pip sync --python data/processed/tooling/runtime/bin/python --require-hashes requirements-runtime.txt
uv run --locked python -m backend.scripts.benchmark_deployment --python "$PWD/data/processed/tooling/runtime/bin/python"
```

O benchmark rejeita ambientes com PyArrow/scikit-learn/threadpoolctl/PyOD, inicia três processos Uvicorn novos e valida health, API, recargas profundas e erros 404. Cada processo executa cinco consultas de cada cenário. A referência LOF de Houston permanece com 74 jogos e exibição de 35 em casa. As medições incluem o início do processo até health disponível, sem usar resultados inferidos do tempo de build.

O relatório local `data/processed/deployment-verification.json` guarda tamanhos, identidade do pacote, tempos, amostras, RSS observado e hashes; é ignorado pelo Git. **Cold start de processo local não equivale a cold start da Vercel.** A memória é uma observação do processo Linux, não um limite ou medição da plataforma.

Referência local em 29/10/2026, com Python 3.12.13 e Node 24.22.2:

| Medida | Resultado local aproximado |
| --- | --- |
| Fonte empacotada, dados e frontend | 4,74 MB |
| Site-packages do runtime + fonte | 256 MB sem compressão |
| Início até health, mediana de três processos | 0,97 s |
| Summary Atlanta em casa, mediana / p95 | 9,1 / 14,6 ms |
| Comparação em casa, mediana / p95 | 60,3 / 71,2 ms |
| LOF Houston em casa, mediana / p95 | 4,7 / 6,4 ms |
| RSS observado após as consultas | Cerca de 216 MB |
| JavaScript inicial, gzip | Cerca de 126 kB |
| Chunk ECharts sob demanda, gzip | Cerca de 172 kB |

São quinze requisições por cenário, sem tráfego externo, concorrência ou rede da nuvem. Os números completos ficam no relatório gerado. O tamanho comprimido não substitui o limite de bundle Python sem compressão. O aviso Vite sobre o chunk ECharts acima de 500 kB sem compressão permanece visível; o carregamento sob demanda limita seu impacto ao gráfico.

## Publicação verificada na Vercel

Em 29/10/2026, a CLI 65.8.0 foi instalada no usuário e autenticada como `jorgribeiro`. O plugin oficial Vercel foi habilitado no Codex; o MCP compartilhado `https://mcp.vercel.com` foi registrado e autenticado por OAuth, com confirmação para operações de escrita. A sessão corrente ainda não carregou os tools MCP; a publicação e a inspeção usaram a CLI autenticada. Tokens e configurações pessoais não estão no repositório.

Com autorização do usuário, a equipe Hobby existente foi renomeada para **Projetos do Jorge**, com identificador **`projetos-do-jorge`**. O ID da equipe foi preservado, e não houve criação de outra equipe ou mudança de plano.

| Campo | Estado verificado |
| --- | --- |
| URL pública | https://quadrascope.vercel.app |
| Projeto | `quadrascope` |
| Equipe / plano | `projetos-do-jorge` / Hobby |
| Project ID | `prj_oGV8643PcgkFpvxC4NBeYdEnkNgR` |
| Team ID | `team_JDuD2phoQjG3Sx7VTDMBtXEC` |
| Deployment ID | `dpl_ADGTvVVieLmxVWgP61xhVynjhZZo` |
| URL imutável | https://quadrascope-acmnm063b-projetos-do-jorge.vercel.app |
| Painel | https://vercel.com/projetos-do-jorge/quadrascope |
| Estado / framework | READY / FastAPI |
| Target informado pela plataforma | `production` |
| Python / região da função | 3.12 / iad1 |
| Memória configurada / timeout | 2.048 MB / 60 s |
| Duração reportada do build / até READY | 22 s / 40,7 s |
| Output da função informado pela API | 74.013.960 bytes |
| Código | HEAD `ca267b2` + alterações locais da etapa 8 ainda sem commit |
| Release dos dados | `c4ce845dd875a68e054fb3db2ffac5c98d2e6e818fb52cb8898621ed99bb4e37` |

O comando solicitou `--environment preview`, mas a Vercel classificou **o primeiro deploy do projeto novo** como `production` e criou os aliases acima. Esse comportamento foi conferido com `vercel inspect`; não se apresenta essa publicação como preview. Ela continua sendo uma versão de validação técnica, com relatório acadêmico e interpretações ainda incompletos. Nenhum projeto anterior foi substituído.

Os acessos à URL pública foram realizados sem login, sem remover ou alterar a configuração de Deployment Protection. Os dez endpoints responderam 200; erros de rota/assets/ID retornaram 404, consulta inválida 422 e ETag correspondente 304. Os quatro testes Playwright passaram na URL publicada, incluindo filtros reais, recarga de `/comparar`, estados vazio/503 simulado, URL inválida e navegação móvel. O release retornado coincidiu com o pacote validado. Nenhum erro/fatal foi retornado pela consulta de logs de runtime na janela verificada de 30 minutos; isso descreve somente aquela consulta, não ausência permanente de falhas. Drains não foram configurados nesta etapa.

### Medição na nuvem e limite do Hobby

Foram feitas cinco requisições HTTP por cenário, incluindo rede/TLS entre o cliente no Brasil e a aplicação:

| Cenário | Mediana / p95 observados |
| --- | --- |
| Summary Atlanta em casa | 467 / 475 ms |
| Comparação em casa | 574 / 599 ms |
| LOF Houston em casa | 455 / 462 ms |

Os valores exatos e todas as amostras estão em `data/processed/vercel-verification.json`. São medições de ponta a ponta; não se confundem com o tempo de cálculo Python nem isolam inicialização da função.

O schema da Vercel expôs a dimensão `functionStartType`, mas as consultas de TTFB/duração agrupadas por essa dimensão retornaram `payment_required`: “Observability Plus is required for this query.” Nenhum upgrade ou compra foi feito. A inicialização local de cerca de 0,97 s continua documentada separadamente; **cold start isolado na nuvem não foi medido**. P8.08 permanece parcial por essa limitação. Uma alternativa futura é instrumentar explicitamente a inicialização da aplicação, distinguindo-a da inicialização completa da plataforma, sem alterar o plano.

### Reproduzir as verificações e novas publicações

Para rodar o mesmo teste de navegador na URL real, sem iniciar servidores locais:

```bash
E2E_BASE_URL=https://quadrascope.vercel.app npm run test:e2e --prefix frontend
```

Para novas versões de teste, após gerar dados/frontend/pacote e conferir o destino:

```bash
vercel deploy .deployment --project quadrascope --scope projetos-do-jorge --environment preview
```

A criação inicial do projeto utilizou `--create-if-missing`; esse flag não é necessário agora. A publicação usa o pacote `.deployment/`, e não o checkout completo. Não conectar automaticamente o repositório raiz ao projeto: o build remoto precisa receber o pacote mínimo, ou ter uma preparação equivalente explicitamente configurada.

Acompanhar o estado com `vercel inspect <deployment-url> --scope projetos-do-jorge`; logs com `vercel logs --project quadrascope --scope projetos-do-jorge`. A publicação automática da `main` e a recuperação manual estão documentadas na [entrega](delivery.md#deploy-automático-da-main). O acesso público atual comprova a infraestrutura, mas não conclui o relatório acadêmico ou a submissão final.

### Revisão do escopo dos filtros

Em 29/10/2026, a revisão solicitada pelo usuário foi publicada no deployment `dpl_C7RhAsGFqySQDTYtkwCbb288ggVb` (https://quadrascope-6fw2mc1ur-projetos-do-jorge.vercel.app), com build reportado em 27 s. O candidato de produção foi gerado com `--prod --skip-domain` e promovido ao domínio público com `vercel promote`. A URL imutável exigiu autenticação; a verificação HTTP e de navegador foi concluída no domínio público após a promoção, sem alterar Deployment Protection.

Os seis testes Playwright passaram em https://quadrascope.vercel.app (13,7 s), incluindo os dois novos casos: filtros somente na Home/Comparação e normalização de links antigos de perfil antes de consultar o histórico completo. Os 24 testes unitários, lint, formatação, TypeScript e build passaram localmente. A Home serviu `/assets/index-Bbpt0Khg.js`; o health anônimo retornou `ready` e o mesmo release dos dados. Evidência local adicional: `data/processed/vercel-filter-scope-verification.json`. Esta revisão permanece nas alterações da etapa 8 ainda sem commit.

### Revisão do P8.08 antes do commit

Em 29/10/2026, a consulta abaixo foi repetida no projeto e equipe corretos, sem alterações de plano:

```bash
vercel metrics vercel.function_invocation.function_duration_ms \
  --project quadrascope --scope projetos-do-jorge \
  --environment production --group-by functionStartType --since 24h --json
```

A CLI retornou novamente `payment_required`, com a mensagem `Observability Plus is required for this query.` Isso confirma a limitação dessa consulta; não prova que toda forma alternativa de instrumentação exija pagamento. Medir importação/carregamento dos artefatos dentro da aplicação seria possível sem mudar o plano, mas deixaria de fora o provisionamento e parte da inicialização da plataforma. Essa medição parcial não deve ser apresentada como cold start completo. Nenhum critério de aceite foi alterado: P8.08 continua aberto para essa métrica.

Antes do commit, `make check` passou com 236 testes Python e Ruff/formatação, e `npm run check --prefix frontend` passou com 24 testes Vitest, ESLint, Prettier, TypeScript e build. Os seis Playwright já haviam passado na versão pública atual, cujo bundle permanece `index-Bbpt0Khg.js`. Os avisos conhecidos são a depreciação Starlette/httpx no cliente de testes e o chunk ECharts acima de 500 kB sem compressão, carregado sob demanda.

### P8.08 — medição com instrumentação própria

O P8.08 foi executado com tempos da **inicialização da aplicação em workers reais da Vercel**, tamanho do pacote e consultas representativas. O escopo medido é o trabalho Python observável; o provisionamento anterior ao entrypoint continua sem medição isolada. Essa limitação permanece registrada e não foi substituída pelo tempo local ou por uma diferença entre chamadas HTTP.

A instrumentação em [telemetry.py](../../backend/app/telemetry.py) é ativada somente pelo entrypoint de publicação. Não cria endpoints nem muda corpos JSON, OpenAPI ou ETags. Em respostas `/api/*`, acrescenta:

| Campo | Significado |
| --- | --- |
| `Server-Timing: qs_import` | Do início de `app.py`, após importar `time`, até configurar a aplicação: imports, factory e rotas |
| `Server-Timing: qs_startup` | Entrada no lifespan: validação/carregamento dos artefatos; não inclui espera pelo primeiro acesso |
| `Server-Timing: qs_app` | Atendimento ASGI até emitir os headers; exclui startup anterior e envio do corpo |
| `X-QuadraScope-Worker` | Identificador aleatório do processo instrumentado; permite agrupar amostras sem expor hostname/PID |
| `X-QuadraScope-First-Request` | `1` somente na primeira requisição HTTP atendida pelo middleware, incluindo caminhos fora da API; não garante ausência de pré-aquecimento |

Tempos de importação e startup são preservados para consulta em respostas posteriores. Assim, é possível medir a inicialização mesmo quando o coletor não recebe a primeira resposta do worker. Não se soma `qs_import` a cada consulta quente.

Em 29/10/2026, foram observados dois workers do deployment `dpl_6u6uKif3jD8ZmoLmD1QGamTvQU7N`, produção READY, Python 3.12/iad1, Hobby. Cada coleta fez cinco chamadas sequenciais por cenário, totalizando quarenta chamadas. O estado READY levou 29,423 s; o builder reportou 13 s. Código: base `820bf12` mais instrumentação local ainda sem commit. A URL imutável é https://quadrascope-7o1bw0b6m-projetos-do-jorge.vercel.app; o domínio público permanece https://quadrascope.vercel.app.

| Worker observado | Importação | Startup dos artefatos | Soma das fases observadas |
| --- | --- | --- | --- |
| `d159cd16…` | 5.276,015 ms | 664,485 ms | 5.940,500 ms |
| `7f560931…` | 4.445,789 ms | 778,913 ms | 5.224,702 ms |

Nenhuma coleta recebeu o marcador de primeira requisição. Portanto, as latências HTTP abaixo são de acessos posteriores à primeira requisição do worker; **não estimam penalidade HTTP de cold start**. A inicialização foi recuperada dos tempos preservados. As duas observações são insuficientes para estimar uma distribuição de cold starts ou SLA. O custo de inicialização observável ficou entre 5,22 e 5,94 s; não foi assumido como tempo completo da plataforma.

Resultados da segunda coleta, com cinco amostras por cenário:

| Consulta | HTTP total mediana / p95 | Aplicação até headers mediana / p95 |
| --- | --- | --- |
| Health | 443,04 / 484,06 ms | 1,25 / 1,74 ms |
| Summary Atlanta em casa | 452,67 / 459,84 ms | 16,61 / 16,80 ms |
| Comparação em casa | 581,94 / 597,91 ms | 109,01 / 125,00 ms |
| LOF Houston em casa | 433,65 / 456,76 ms | 8,13 / 10,91 ms |

O p95 usa nearest-rank; com cinco amostras ele coincide com o máximo. HTTP inclui rede/TLS/plataforma; a diferença para `qs_app` não é atribuída integralmente à Vercel. LOF manteve referência de 74 jogos e exibição de 35, e todas as respostas conferiram o release esperado.

| Tamanho/limite | Medição atual |
| --- | --- |
| Arquivos de origem preparados, sem o próprio manifesto | 4.748.249 bytes |
| Site-packages local do runtime reduzido | 251.286.927 bytes |
| Estimativa local sem compressão | 256.035.176 bytes |
| Output da função reportado pela Vercel | 74.092.783 bytes; não identificado como tamanho completo sem compressão |
| Memória configurada / duração máxima | 2.048 MB / 60 s |
| Processos locais novos, até health pronto | 2,971 / 0,976 / 0,976 s; mediana 0,976 s |

O pacote foi aceito pela Vercel e a estimativa local permanece abaixo do limite documentado de 500 MB para Python. Não foi necessário aumentar plano, memória ou timeout. A separação das dependências offline e o carregamento lazy do ECharts continuam aplicados. O aviso do chunk acima de 500 kB sem compressão permanece documentado; ele não impediu os testes nem o deploy. Não se adicionou pré-aquecimento artificial ou chamadas periódicas.

#### Reproduzir e auditar

A [evidência versionada](measurements/p8-08.json) preserva todas as amostras das duas coletas, hashes do código de instrumentação/empacotamento, release, tamanhos e medições locais. O primeiro coletor exigia observar a primeira resposta e registrou `no_first_request_observed`; suas amostras de inicialização foram preservadas. A versão final separa o sucesso da medição de inicialização do campo `first_http_observed`, sem inventar uma chamada fria.

```bash
make deploy-prepare
uv run --locked python -m backend.scripts.benchmark_deployment \
  --python "$PWD/data/processed/tooling/runtime/bin/python"
uv run --locked python -m backend.scripts.benchmark_cloud \
  --base-url https://quadrascope.vercel.app \
  --release c4ce845dd875a68e054fb3db2ffac5c98d2e6e818fb52cb8898621ed99bb4e37 \
  --deployment dpl_6u6uKif3jD8ZmoLmD1QGamTvQU7N \
  --output data/processed/p8-08-cloud-verified.json
```

O ID informado identifica o deployment inspecionado pelo operador; o coletor confere release e instrumentação das respostas, mas não resolve aliases da Vercel. Em nova publicação, conferir primeiro o deployment/domínio e substituir esse ID. Workers e tempos podem mudar em uma repetição. A coleta rejeita releases divergentes, instrumentação ausente e respostas HTTP de erro; não depende de tokens ou acesso pago.

Referências: [diagnóstico oficial de funções lentas](https://vercel.com/docs/functions/debug-slow-functions) e [runtime Python](https://vercel.com/docs/functions/runtimes/python). A comparação entre acessos sugerida pelo diagnóstico é complementada aqui por tempos do worker; nenhuma diferença entre requisições foi usada como medição exata de cold start.

Validação final desta revisão: `make check` aprovado com **241 testes Python**, Ruff e formatação; seis testes Playwright aprovados na URL pública. A prova local utilizou somente as vinte dependências de runtime, sem PyArrow/scikit-learn/threadpoolctl/PyOD, e conferiu API/SPA/assets e erros 404. Na consulta `level:error OR level:fatal`, filtrada pelo deployment e janela de 15 minutos, foram retornados zero registros; essa observação não garante ausência permanente de erros. Drains não foram configurados.

## Publicação da etapa 9 — relatório completo

Em 29/10/2026, o commit **`c51acd9`** foi publicado em **https://quadrascope.vercel.app**. P9.01–P9.12 estão implementados; etapas 10–11 e submissão continuam pendentes. A publicação não mudou o Hobby nem Deployment Protection.

| Campo | Evidência |
| --- | --- |
| Deployment | `dpl_9nyXQ9PXGkw4vwwZ9jpi6K4GgJqL` |
| URL imutável | https://quadrascope-7lcrqdpob-projetos-do-jorge.vercel.app |
| Target / estado / framework | production / READY / FastAPI |
| Commit de origem | `c51acd9ebdbfa2564da98dd718c4e4e8d0fa38cf` |
| Release dos dados | `ddd1fb5f8683d83e602caef5846027156a5194f257491c51221a27bb3d0a8a94` |
| Build reportado / até READY | 20 s / 37,304 s |
| Runtime / região | Python 3.12 / iad1 |
| Output da função reportado pela Vercel | 74.060.131 bytes; não equivale necessariamente ao tamanho completo sem compressão |
| Fonte / estimativa local sem compressão | 4.823.909 / 256.110.836 bytes |
| Bundle inicial publicado | `/assets/index-DAKMV9pe.js` |

O código foi commitado antes do build dos dados. O manifesto registra o commit acima e `git_dirty=false`. O pacote reduzido foi montado e testado com as vinte dependências reais de runtime, sem as dependências offline. O benchmark local iniciou três processos novos, com mediana até health de 1,038 s. A estimativa de tamanho permanece abaixo do limite documentado; o empacotador da Vercel aceitou a função.

O candidato foi gerado com `--prod --skip-domain` e metadados `sourceCommit`/`stage=9`, no projeto/equipe previamente verificados. O health autenticado foi consultado com `vercel curl`, usando o link do pacote `.deployment/`; confirmou o release. `/quality` confirmou inventário de 50 análises e `/interpretations` confirmou leitura filtrada de Atlanta em casa com n=38. O acesso ao candidato foi autenticado, sem apresentar essa verificação como acesso público. O mesmo deployment de produção foi promovido sem rebuild.

Depois da promoção, **onze Playwright passaram sem login em 41,9 s**. A suíte percorreu os 14 pares variável/time e os sete métodos nos dois times; verificou seleção univariada, recarga dos fragmentos, filtros, erros, n=0/n=1, contexto fixo separado e navegação móvel. Vinte verificações HTTP confirmaram seis rotas web, dez endpoints, 404/422 e ETag 304. Rotas web profundas enviam `Accept: text/html`, como um navegador; requisições sem negociação HTML podem receber o 404 de API. O HTML público serviu o bundle acima e os endpoints conferiram o release.

Nova coleta de desempenho: vinte chamadas sequenciais no coletor (cinco por cenário), na mesma janela da conferência HTTP funcional. Medianas HTTP: health 434 ms, summary Atlanta em casa 463 ms, comparação 600 ms e LOF Houston em casa 438 ms. Um worker preservou 4.348,556 ms de importação e 787,913 ms de startup (soma observável 5.136,469 ms). A primeira requisição desse worker não foi recebida pelo coletor; os tempos foram recuperados de respostas posteriores. Não se mediu o provisionamento anterior ao Python, penalidade HTTP causal de cold start ou SLA; também não se afirma isolamento de concorrência nessa coleta.

Na consulta `level:error OR level:fatal`, filtrada por esse deployment e janela de 15 minutos, foram retornados zero registros, sem intervalos excluídos. Isso descreve aquela janela, não garante ausência permanente de erros. Drains não foram configurados. A limitação do chunk ECharts sob demanda acima de 500 kB e o aviso de depreciação no cliente de testes permanecem documentados.

[Relatório versionado de evidências](measurements/stage9-verification.json), [mapa das páginas](report.md) e [testes](../../frontend/e2e/report.spec.ts). A atualização documental posterior à publicação apenas registra essas evidências; o código executável publicado é o commit `c51acd9`.


## Publicação da etapa 10 — revisão e correções

Em **30/10/2026**, o commit `83e82768758ae43df8a905e428b2abf700747ffb` foi publicado em **https://quadrascope.vercel.app**, na equipe `projetos-do-jorge`, sem alteração de plano ou proteção. Deployment `dpl_J3xghwzHXBPShUFoVqBSSw4U7sYT`, estado `READY`, alvo `production`; o alias público foi conferido contra esse ID. A versão candidata foi testada com autenticação antes da promoção do mesmo build.

O release `27a55bc15c275c249d281378360b79ffa19f2a230942b345105b3ea0d6ef5534` foi gerado após o commit, com `git_dirty=false`. O CSV permanece intacto. Build de 19 s; saída de função reportada pelo provedor: 74.066.356 bytes, Python 3.12 em `iad1`, 2.048 MB e timeout de 60 s. Esse tamanho não representa o tamanho descomprimido do ambiente.

**Validação pública:** 27 Playwright aprovados em 147,95 s, sem falhas, testes ignorados ou instáveis; 19 verificações HTTP sem login, cobrindo seis rotas HTML, os dez endpoints, respostas 404/422 e ETag/304. As telas carregaram o bundle `index-BRZbTNN1.js`. A auditoria inclui dados exibidos versus CSV, acessibilidade, teclado/menu móvel, filtros, cache e respostas atrasadas. Validação local anterior: 245 testes Python, 25 Vitest, contratos, lint, formatação e build.

O pacote mínimo passou em ambiente isolado, sem bibliotecas do pipeline offline. Nova coleta de vinte chamadas recuperou inicialização da aplicação de aproximadamente 5,29–5,80 s em dois workers; não houve primeira resposta HTTP observada nessa coleta, e o provisionamento anterior ao Python continua sem medição isolada. A coleta ocorreu durante os testes de navegador e não representa carga isolada. Nenhum registro `error`/`fatal` foi retornado na janela de quinze minutos consultada para esse deployment; essa observação não garante ausência futura de erros.

[Evidências da publicação](measurements/stage10-deployment.json), [revisão e limites](validation.md). O commit posterior de documentação registra a publicação; o código executável publicado é `83e8276`. A etapa 11 e a confirmação da submissão pelo grupo permanecem pendentes.


## Publicação da etapa 11 — preparação da entrega

Em **31/10/2026**, o pacote validado na instalação isolada foi publicado e promovido em https://quadrascope.vercel.app, equipe `projetos-do-jorge`, projeto `quadrascope`, sem mudar plano ou proteção. Deployment **`dpl_BbSEwceZB9iRzVYzi2Ga92x6DNcJ`**, estado `READY`, alvo `production`; candidata: https://quadrascope-d3mrcmnth-projetos-do-jorge.vercel.app. O alias público foi conferido contra esse ID.

Não houve novo commit/push. A revisão executável está identificada pela base `cabb95087e18c6457de1da5195f755dd29dea247` e pelo SHA-256 do snapshot testado `9a2d802f46c8656ef574e6654b9cfa10680ab1039f5f784d967d8c8d2b8d68d0`, gravados nos metadados da publicação; o manifesto científico declara `git_dirty=true`. Não atribuir essas alterações à versão remota do commit-base. Release: `8fe1ced7e2eae1fb2405a4f096ee0d07f567871e71b672e524591c4619653b25`. O CSV e os resultados científicos foram preservados; a nova identidade inclui os arquivos de preparação e o contexto Git.

Build de 28 s. A candidata teve health e consultas de resumo, comparação e interpretação conferidos por acesso autenticado antes da promoção. Após promover o mesmo build, passaram **27 Playwright públicos em 148,04 s** e **19 verificações HTTP** sem autenticação, com páginas profundas, dez endpoints, respostas esperadas 404/422 e cache ETag/304. Os mesmos 27 testes passaram localmente na instalação isolada. O bundle React permanece `index-BRZbTNN1.js`.

O pacote mínimo foi conferido no ambiente de runtime isolado, com estimativa local de 256.156.608 bytes descomprimidos; essa estimativa não é uma medição do limite da plataforma. Não foi feita nova medição isolada de provisionamento da Vercel. [Reprodução, entrega e recuperação](delivery.md), [evidências](measurements/stage11-verification.json). O procedimento de rollback está documentado; não foi provocado um rollback em produção para testá-lo.
