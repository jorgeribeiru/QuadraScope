# Plano de organização e consulta do relatório web

Implementado na branch `melhorias`, derivada da `main` em `162d33f`, em 31/10/2026. Validação concluída sem regenerar dados; publicação não realizada. [Implementação, execução e evidências](../development/frontend-review.md).

## Objetivo

Facilitar a leitura, a consulta e a conferência do projeto pelo professor. O visitante deve conseguir partir de um item do PDF, localizar a explicação e abrir sua evidência com o time, a variável, o método e a seção corretos.

O trabalho prioriza o frontend e reutiliza os resultados atuais. Mudança de backend fica limitada a uma necessidade comprovada de consulta ou exposição de informação já existente.

## Limites desta etapa

- Não regenerar releases, JSONs científicos, Parquet ou relatórios do pipeline.
- Não alterar CSV, fórmulas, parâmetros, detectores, limiares ou convenções estatísticas.
- Não duplicar fórmulas científicas no JavaScript. Os seletores gráficos usarão medidas já devolvidas pela API.
- Preservar o comportamento atual dos filtros: Visão geral e Comparação acompanham a seleção; perfis e detectores usam o histórico completo do time.
- Filtros locais de tabelas modificam a exibição das linhas, sem redefinir a população das estatísticas.
- Não ampliar a detecção para outras colunas nesta etapa. A ressalva identificada na avaliação continua documentada.
- Não preencher detalhes desconhecidos da coleta por suposição.
- Não publicar nem alterar a hospedagem durante a elaboração do plano.

## O que já pode ser aproveitado

- Índice de seis assuntos em Dados e métodos, com links de retorno.
- Seções identificadas e códigos R01–R24 distribuídos pelo relatório.
- Seleção de variável nos perfis e de time/método/variável nos detectores, persistidas no fragmento da URL.
- Dicionário completo, auditoria, inventário das 50 análises e todas as medidas descritivas na API.
- Quartis, cercas, média, modas e pontos atípicos nos dados dos boxplots.
- Tabelas ordenáveis, tratamento de ausência de resultados e componentes acessíveis existentes.

## Organização proposta

Adicionar uma área **Guia do projeto**, com rota sugerida `/guia`, acessível no menu e por um atalho na Visão geral. Ela reunirá:

1. **Por item do enunciado:** índice na ordem do PDF, com descrição, página do PDF e links para explicação, tabela e gráfico pertinentes.
2. **Mapa do site:** árvore das páginas e seções, com descrições curtas e destinos clicáveis. Trata-se de navegação para pessoas; um sitemap XML para mecanismos de busca não é necessário para este objetivo.
3. **Consultas prontas:** atalhos para perguntas frequentes na avaliação, com seleções e destino preenchidos.

Exemplos de consultas prontas:

- Onde estão os tipos e as renomeações das colunas?
- Como foram tratadas as datas e as ausências?
- Quais são os outliers de pontos de Atlanta?
- Como os times se comparam no CV das sete variáveis?
- Onde estão Q1, Q3 e IQR por time?
- Como o teste de Grubbs foi aplicado a Houston?

Os índices internos continuam próximos do conteúdo. A busca global encontra assuntos e destinos sem exigir que o visitante conheça a página de origem.

## Etapa 1 — Cadastro de conteúdo e identidade dos resultados

- [x] Criar um cadastro único no frontend de páginas, seções, temas e requisitos, reaproveitado pelo guia, mapa, busca e índices.
- [x] Mapear os R01–R24 existentes para a redação e a ordem do PDF; esses códigos são uma organização interna, não uma rubrica oficial.
- [x] Registrar, por destino, título, descrição curta, página/item do PDF, palavras-chave, rota, seção e seleções necessárias.
- [x] Usar informações editoriais de localização, sem marcar requisitos automaticamente como cumpridos.
- [x] Identificar a versão atual da API, o release e o hash da fonte como referência de preservação dos resultados.
- [x] Conferir a existência de um pacote de dados já produzido que possa ser reutilizado numa publicação futura.

**Aceite:** os mesmos títulos e destinos alimentam as diferentes formas de navegação; todos os itens do PDF têm localização ou limitação explicitamente indicada.

## Etapa 2 — Links diretos e índices internos

- [x] Padronizar links para time, variável, método e seção de destino.
- [x] Compatibilizar âncoras de seção com os fragmentos já usados para seleções. Exemplo de formato a validar: `#variavel=BLK&secao=boxplot`.
- [x] Preservar links antigos, comportamento dos filtros e histórico de navegação do navegador.
- [x] Ao abrir um destino, aguardar o conteúdo, expandir o bloco necessário e levar foco à seção correta.
- [x] Acrescentar índices aos perfis, à Comparação e a Fora da curva; manter e integrar o índice de Dados e métodos.
- [x] Oferecer retorno ao índice e cópia do link direto, com feedback acessível.

**Aceite:** abrir ou recarregar um link como “Houston → BLK → Boxplot” apresenta a seleção e a seção corretas. Teclado e tela pequena permitem o mesmo percurso.

## Etapa 3 — Guia do projeto e mapa do site

- [x] Implementar a área proposta, com os itens na ordem do enunciado.
- [x] Apresentar links distintos quando explicação, resultado e interpretação estiverem em lugares diferentes.
- [x] Incluir o mapa agrupado por página, sem duplicar o conteúdo analítico.
- [x] Incluir as consultas prontas e um roteiro curto de apresentação: base → qualidade → medidas → distribuições → comparação → anomalias → síntese.
- [x] Usar rótulos compreensíveis; deixar os códigos de requisito como informação complementar.
- [x] Identificar destinos de escopo completo e destinos que acompanham filtros.

**Aceite:** o professor consegue localizar a evidência de um item do PDF a partir do guia, sem precisar deduzir a organização atual do site.

## Etapa 4 — Busca e consultas nas tabelas

- [x] Implementar busca global pelo cadastro de assuntos, seções, requisitos e consultas prontas.
- [x] Aceitar siglas, nomes em português e sinônimos úteis: BLK/tocos, STL/roubos, missing/ausências, Q1/quartil, entre outros.
- [x] Tornar a busca indiferente a maiúsculas e acentos; permitir acesso por teclado e mostrar estado sem resultados.
- [x] Deixar claro que a busca localiza assuntos e destinos cadastrados; ela não pesquisa automaticamente todo texto e toda partida da aplicação.
- [x] Adicionar busca/filtros locais, quando úteis, ao dicionário, à auditoria e às tabelas de anomalias.
- [x] Mostrar quantidade de linhas exibidas, opção de limpar e combinação com a ordenação existente.
- [x] Reaproveitar as respostas já carregadas; iniciar sem um novo endpoint de busca.

**Aceite:** pesquisar “tocos” leva às opções relacionadas a BLK; pesquisar “Little” leva à explicação correta; filtrar linhas não altera as medidas nem a referência dos detectores.

## Etapa 5 — Leitura e apresentação dos resultados existentes

- [x] Organizar as leituras extensas em achado, evidência e implicação, preservando as explicações exigidas pelo PDF.
- [x] Utilizar os campos estruturados já disponíveis; evitar depender de cortes frágeis por frases no texto recebido da API.
- [x] Reduzir repetição de limitações, mantendo-as próximas dos resultados aos quais se aplicam.
- [x] Complementar as justificativas de uso/exclusão de colunas com explicações específicas no frontend, coerentes com a metodologia atual.
- [x] Acrescentar rótulos dos elementos dos boxplots com os valores existentes, cuidando de sobreposições e de múltiplas modas.
- [x] Permitir escolher a medida do gráfico comparativo, inicialmente média, mediana, desvio padrão, CV e IQR, usando as respostas existentes.
- [x] Atualizar título, unidade, descrição acessível, tabela associada e texto do gráfico conforme a medida escolhida.
- [x] Na proveniência, melhorar a organização das informações conhecidas e das não informadas. Completar detalhes somente se forem fornecidos pelo grupo.

**Aceite:** muda a forma de apresentar e consultar os resultados; os valores e decisões científicas permanecem os mesmos. Unidades diferentes nunca compartilham uma escala sem identificação apropriada.

## Etapa 6 — Validação sem regenerar dados

- [x] Executar lint, verificação de tipos, testes pertinentes e build do frontend.
- [x] Desenvolver e validar a interface por um proxy para a API existente, quando não houver artefatos locais disponíveis.
- [x] Adaptar o modo de execução dos testes de navegador para frontend local e backend existente; `E2E_BASE_URL` isoladamente testaria a interface já publicada.
- [x] Verificar links diretos, recarga, voltar/avançar, abertura de blocos, busca, filtros de tabela, teclado, foco e tela pequena.
- [x] Conferir que as novas apresentações correspondem aos valores devolvidos pela API e que os estados vazio/indefinido/erro continuam corretos.
- [x] Conferir que os arquivos científicos e as identidades de fonte/release foram preservados.
- [x] Documentar a forma de publicar reaproveitando o pacote existente, sem executar o pipeline.

**Cuidados operacionais:** `make run`, `make ci` e o workflow completo atual incluem geração de dados. Eles não são o fluxo de validação desta etapa. A configuração atual dos testes locais também pressupõe API local com artefatos. O empacotador de publicação copia um release existente: para uma publicação futura, será necessário reutilizar ou recuperar esse pacote, sem reconstruí-lo a partir das respostas HTTP nem regenerá-lo por iniciativa própria.

**Aceite:** interface validada com dados reais existentes, sem execução do pipeline científico. Se for necessária alguma consulta adicional no backend, ela deve apenas expor ou organizar informação disponível, com contrato e verificação proporcionais à alteração.

## Ordem de entrega sugerida

1. **Entrega A — Localização:** etapas 1–3, com validação dos percursos. Maior impacto na conferência pelo professor.
2. **Entrega B — Consulta:** etapa 4, com validação de busca e tabelas.
3. **Entrega C — Apresentação:** etapa 5, com validação das medidas e gráficos.

Cada entrega deve ser revisável localmente. A publicação fica para uma etapa posterior, usando o mesmo conjunto de dados.

## Resultado da validação

31 testes unitários e 32 cenários de navegador aprovados com frontend local e API existente. A auditoria Python dependente de artefatos locais foi explicitamente ignorada nesse modo. Backend, dados, parâmetros e identidade pública foram preservados. O pacote científico não está neste checkout; a publicação futura depende de recuperar uma cópia íntegra do pacote já produzido.
