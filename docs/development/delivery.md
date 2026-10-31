# Reprodução e entrega — etapa 11

O relatório é a própria aplicação: **https://quadrascope.vercel.app**. Repositório de origem: **https://github.com/JorgRibeiro/QuadraScope**. O PDF do enunciado pede código por ZIP ou link de repositório e o endereço da aplicação no campo da submissão. Não exige um relatório separado.

## Instalar e iniciar em outra máquina

Ambiente validado: Linux, Python 3.12, Node 24, uv 0.11.7, Git e GNU Make. No Windows, usar WSL2; execução nativa Windows não foi validada, pois o iniciador encerra grupos de processos POSIX. macOS requer as mesmas ferramentas, mas não integra a prova de instalação desta entrega. São necessários acesso à internet na instalação e portas locais 8000/5173 livres. Nenhuma conta NBA, chave de API ou arquivo `.env` é necessário para analisar o CSV entregue.

No repositório clonado ou no ZIP extraído, entrar na pasta `QuadraScope`. Selecionar Node 24 (`nvm install` e `nvm use`, quando nvm estiver instalado). Instalação inicial:

```bash
make install
```

Execução, incluindo geração e validação dos artefatos:

```bash
make run
```

Abrir http://127.0.0.1:5173. API: http://127.0.0.1:8000/docs. `Ctrl+C` encerra API e frontend. O build ocorre antes dos servidores; uma falha de dados impede a inicialização. `make dev` continua disponível para iniciar com artefatos já gerados. A API mantém um snapshot durante o processo; após mudar dados, reiniciar com `make run`.

Python executa as análises científicas e a API FastAPI; React apresenta tabelas/gráficos e navegação, sem duplicar as fórmulas científicas. A escolha foi confirmada pelo grupo. uv gerencia Python, locks e dependências; npm gerencia o frontend e seu lock. `requirements.txt` contém runtime + pipeline, com hashes; `requirements-runtime.txt` contém somente o runtime da hospedagem. O ZIP não inclui ambientes instalados, cache ou dependências compiladas: instalação inicial continua necessária.

## Conferência e CI

```bash
make ci
npm exec --prefix frontend -- playwright install chromium
npm run test:e2e --prefix frontend
```

Em um checkout Git, `make ci` executa ambiente, Ruff, testes científicos/API, build/validação/auditoria dos artefatos, reprodução independente, comparação dos exports de dependências, geração/checagem dos contratos TypeScript e build/testes do frontend. O job `verify` do workflow [.github/workflows/ci.yml](../../.github/workflows/ci.yml) repete esses comandos no Ubuntu 24.04, instala Chromium com bibliotecas do sistema e executa os testes de navegador. Actions são fixadas por SHA, com permissão de leitura. As verificações não recebem credenciais de hospedagem.

O workflow executa em pushes, pull requests e acionamento manual. A primeira execução remota da CI, no commit `162d33f`, foi aprovada no GitHub. Os testes iniciam serviços isolados em 8018/4178 e os encerram ao terminar.

No ZIP sem `.git`, os comandos de execução `make install` e `make run` funcionam normalmente; para verificar o código sem as comparações Git do CI, executar `make check`, `make data-validate`, `make report-audit` e `make web-check` após o primeiro `make run`.

## Deploy automático da main

O job `deploy` depende da aprovação integral de `verify` e executa somente na branch `main`, em push ou acionamento manual. Pull requests e outras branches executam as verificações. O runtime `.deployment/` gerado pela CI é transferido entre jobs como artefato de um dia; `.python-version` é preservado e `.vercel/` é excluído.

Configuração inicial: criar um token com acesso à equipe `projetos-do-jorge` em [Vercel → Tokens](https://vercel.com/account/settings/tokens) e cadastrar seu valor como **`VERCEL_TOKEN`** em [GitHub → Actions secrets](https://github.com/JorgRibeiro/QuadraScope/settings/secrets/actions). O token deve ser inserido diretamente no GitHub. Renovar o secret antes da expiração ou após revogar o token. Os IDs da equipe e do projeto já estão no workflow; nenhuma outra variável é necessária.

O ambiente GitHub `production` restringe publicação à `main`, sem aprovação manual. A CLI Vercel está fixada em 65.8.0. O job envia somente o runtime mínimo à Vercel com `--prod --skip-domain`, preservando o build remoto FastAPI/CDN usado pelo projeto. Os rewrites em `deployment/vercel.json` servem o index React nas páginas internas; na validação desta automação, `/comparar` retornou 404 tanto na publicação anterior quanto nas candidatas sem esses rewrites. O job confere health, identidade do release e HTML da Home e de `/comparar` na candidata, usando `vercel curl` para preservar Deployment Protection. Somente depois promove a mesma versão e verifica o health público. Falhas anteriores à promoção deixam o domínio público na versão anterior; falhas posteriores são reportadas na CI e exigem inspecionar a publicação e, se necessário, seguir o procedimento de recuperação abaixo.

O secret é exposto somente aos passos que conferem a credencial ou autenticam na Vercel. `.vercel/` não é publicado como artefato. Execuções da `main` são serializadas para não interromper uma publicação em andamento. O projeto Vercel permanece sem integração Git direta: o deploy usa o pacote mínimo validado, sem enviar ferramentas científicas offline para o runtime.

## Pacote identificado e verificável

```bash
make delivery
```

Executar em um checkout Git. O comando produz `dist/delivery/quadrascope-<hash>.zip` e `dist/delivery/manifest.json`. O manifesto identifica o commit-base, se há alterações locais e o SHA-256 do snapshot completo de arquivos. Dentro do ZIP, `DELIVERY-MANIFEST.json` registra cada caminho e seu hash; o manifesto externo também registra o SHA-256 do ZIP. O comando confere a integridade do arquivo e de todos os membros antes de concluir.

O pacote captura o código atual (arquivos versionados e novos não ignorados); não afirma que mudanças locais já estão no GitHub. Conferir `git_dirty` e `source_snapshot_sha256`, e enviar o ZIP gerado. Para usar somente o link do repositório, primeiro publicar a revisão pretendida e conferir acesso do professor. O ZIP funciona sem `.git`; sua identidade científica será pelo conteúdo e pelo manifesto, sem inventar um commit Git.

Inclui código, testes, workflow, locks, documentação, CSV original usado pelo grupo e enunciado fornecido. Não inclui `.git`, `.venv`, `node_modules`, `.env`, `.vercel`, `.deployment`, resultados locais nem o próprio ZIP. A origem NBA do CSV foi declarada pelo grupo; não foi fornecida licença de redistribuição pública dos dados ou do enunciado. A preparação deste pacote para a entrega acadêmica não concede licença nova sobre esses materiais. Dependências mantêm suas próprias licenças; o aviso PyOD usado na referência ECOD está preservado.

## Recuperar a hospedagem

1. Conferir https://quadrascope.vercel.app/api/v1/health e a página inicial sem login. Um 503 indica ausência/invalidade dos artefatos; verificar logs antes de publicar novamente.
2. Em uma cópia da revisão pretendida, executar `make install`, `make ci` e os testes de navegador. `make ci` já prepara `.deployment` com dados validados e frontend compilado.
3. Usar uma conta Vercel que tenha acesso ao projeto existente `quadrascope`, equipe `projetos-do-jorge`. Não criar outro projeto/time nem mudar o plano. Com Vercel CLI instalado e autenticado, verificar o alvo:

   ```bash
   vercel project inspect quadrascope --scope projetos-do-jorge
   vercel deploy .deployment --project quadrascope --scope projetos-do-jorge --prod --skip-domain
   ```

4. Guardar o ID/URL retornado. Na pasta `.deployment`, executar `vercel link --yes --project quadrascope --scope projetos-do-jorge` se ela ainda não estiver vinculada; não incluir os arquivos locais de autenticação no pacote. Conferir a candidata protegida com `vercel curl /api/v1/health --deployment <URL> --scope projetos-do-jorge`; esse acesso autenticado não comprova acesso público. Conferir também consultas e o release esperado em `data/processed/current.json`.
5. Promover o mesmo deployment, sem rebuild: `vercel promote <ID> --scope projetos-do-jorge`. Verificar novamente health, páginas profundas e consultas públicas sem autenticação. Para repetir a suíte pública: `E2E_BASE_URL=https://quadrascope.vercel.app npm run test:e2e --prefix frontend`.
6. Se a nova versão falhar, inspecionar logs do ID e usar `vercel rollback <ID-ANTERIOR> --scope projetos-do-jorge` para uma versão previamente verificada. Rollback pode suspender atribuição automática de novos deployments; uma promoção explícita a restabelece. Nenhum rollback é executado apenas para testar este procedimento.

A alternativa local é `make install` + `make run`. O grupo continua responsável por manter o link acessível durante a avaliação. Detalhes de medições, limites e versões publicadas: [deployment.md](deployment.md).

## Campos para o Classroom

- Código-fonte: anexar o ZIP indicado em `dist/delivery/manifest.json`, ou informar o repositório após conferir que a revisão entregue está publicada e acessível.
- Aplicação: **https://quadrascope.vercel.app**.
- Instruções: README do pacote e este guia; ambiente Python 3.12 + Node 24; `make install` e `make run`.
- Conferir disciplina/tarefa, integrantes e anexos no Classroom; o grupo realiza o envio e confirma que foi concluído.

**P11.10 e R06 permanecem abertos enquanto não houver confirmação de submissão pelo grupo.** Preparar arquivos e validar URLs não equivale ao envio.

## Referências da automação

[uv em GitHub Actions](https://docs.astral.sh/uv/guides/integration/github/), [locks e sincronização](https://docs.astral.sh/uv/concepts/projects/sync/) e [setup-node](https://github.com/actions/setup-node). O workflow fixa versões e SHAs revisados, em vez de depender de uma tag móvel.

## Validação da preparação em 31/10/2026

P11.01–P11.09 concluídos; P11.10 e R06 dependem do grupo. [Evidências verificáveis](measurements/stage11-verification.json):

| Verificação | Resultado |
| --- | --- |
| Instalação isolada | Clone local da base `cabb950` + snapshot da etapa 11, sem copiar `.venv`, `node_modules` ou artefatos; caches de download reutilizados |
| Checks do CI | 245 Python, 25 Vitest, Ruff/ESLint/Prettier, contratos e build aprovados; workflow conferido por actionlint 1.7.7 |
| Ciência | 13 artefatos reproduzidos; 14 pares, 50 análises e 3.725 registros auditados |
| Navegador local | 27 Playwright aprovados em 57,64 s |
| ZIP sem Git | `make install` + `make run` aprovados; API, proxy, rota profunda e seleção real conferidos; ambos os servidores encerrados por Ctrl+C |
| Publicação | 27 Playwright aprovados em 148,04 s, sem falhas, testes ignorados ou instáveis; 19 verificações HTTP sem login |
| Dependências mínimas | Pacote validado em ambiente isolado sem PyArrow/scikit-learn/threadpoolctl; frontend de produção sem alertas no npm audit consultado |

O código testado/publicado é o snapshot `9a2d802f46c8656ef574e6654b9cfa10680ab1039f5f784d967d8c8d2b8d68d0`, sobre a base `cabb95087e18c6457de1da5195f755dd29dea247`, com alterações locais declaradas. Na ocasião dessas provas e da publicação, as alterações ainda não estavam commitadas; não foi realizado push. A documentação e os registros finais foram atualizados após as provas; o empacotamento final confere que os 136 arquivos de código/automação/locks permanecem idênticos aos testados. O SHA-256 do ZIP final está no manifesto externo gerado, evitando uma referência circular dentro do próprio pacote.

O workflow foi configurado, lintado e seus comandos passaram localmente; não se afirma execução aprovada no GitHub antes do envio dos arquivos. Permanecem 12 alertas moderados nas ferramentas de desenvolvimento frontend e 3 no gerador de contratos; o audit de produção retornou zero. Não foram forçadas mudanças incompatíveis de dependências para fechar a entrega. A revisão automática usa Chromium e não certifica conformidade WCAG integral.
