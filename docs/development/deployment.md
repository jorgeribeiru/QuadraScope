# Pacote e prova de hospedagem — etapa 8

A topologia preparada usa **uma origem**: FastAPI em `/api/v1`, React nos demais caminhos e assets estáticos. O pacote foi verificado localmente com as dependências reais de runtime. **Publicado e verificado em https://quadrascope.vercel.app** em 29/10/2026. P8.07 concluído; P8.08 tem tamanho/latências registrados e continua parcial porque a Vercel exige Observability Plus para isolar as métricas de cold start consultadas. O plano Hobby foi mantido.

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

Acompanhar o estado com `vercel inspect <deployment-url> --scope projetos-do-jorge`; logs com `vercel logs --project quadrascope --scope projetos-do-jorge`. Publicação de outra versão de produção e integração Git/CI terão procedimento próprio na entrega. O acesso público atual comprova a infraestrutura, mas não conclui o relatório acadêmico ou a submissão final.

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
