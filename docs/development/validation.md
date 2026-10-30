# Revisão de integração, conteúdo e acessibilidade — etapa 10

Revisão realizada em **30/10/2026**, sobre a base `ab40cac` e alterações locais desta etapa. P10.01–P10.08 concluídos. **Correções commitadas em `83e8276` e publicadas em https://quadrascope.vercel.app.** [Evidências da publicação](measurements/stage10-deployment.json). A entrega, a instalação a partir de checkout limpo, CI e a publicação final permanecem na etapa 11; R06 depende da submissão pelo grupo.

A história conferida foi: seleção no navegador → cliente HTTP/cache → API FastAPI → release validado → resposta → medidas, gráficos e interpretação. Foram preservadas as alterações visuais e de legibilidade dos commits `da48068` e `ab40cac`.

## Evidências da revisão

| Fronteira | Resultado e evidência |
| --- | --- |
| Ambiente / código | Python 3.12.13 via uv, Node 24.22.2; Ruff, ESLint, Prettier, TypeScript/build e contratos OpenAPI aprovados |
| Ciência / API | **245 testes Python** aprovados; release validado e novo diagnóstico contextual sem alteração das medidas oficiais |
| Componentes / cache | **25 Vitest** aprovados; cache também verificado no navegador com troca de release/versão, erro 503 e respostas atrasadas |
| Navegador / dados reais | **27 Playwright aprovados em 54,61 s**, sem falhas, testes ignorados ou testes instáveis; 16 casos existentes e 11 novos |
| Acessibilidade final | Auditoria específica reexecutada após o último ajuste de semântica: seis telas, zero violações automáticas; avisos de contraste complementados por **708 verificações de cores computadas** |
| CSV / resultados | Auditoria independente dos 14 pares, matrizes, quartis, histograma, leituras e diagnóstico; 50 análises e **3.725 registros de detectores** conferidos |
| Partidas sinalizadas | **11 ocorrências de outliers IQR nos boxplots e 43 sinalizações** entre métodos/variáveis, com IDs/datas/valores; não são 43 partidas distintas |
| Jornada | Dados → Perfil → Comparação → Anomalias → Síntese percorridos para os dois times; dez paradas registradas, sem erro JavaScript |
| Responsividade / leitura | Seis telas em 320/390/768 px, além do desktop; modas coincidentes e quatro modas de Houston preservadas; tabelas com caption, cabeçalhos e unidades |
| Publicação existente | Seis rotas HTML e health responderam 200 sem login, em leitura apenas. Release público anterior: `ddd1fb5f8683d83e602caef5846027156a5194f257491c51221a27bb3d0a8a94` |

O relatório [stage10-verification.json](measurements/stage10-verification.json) preserva hashes, resultados científicos, ocorrências sinalizadas, nomes dos testes, jornada, cores e escopo de cada verificação. Relatórios completos e capturas locais ficam em `data/processed/stage10-*` e `frontend/test-results/`, ignorados pelo Git. A suíte completa passou antes do último ajuste pontual de `role=group` no resumo de comparação; esse ajuste foi conferido na reexecução específica da auditoria das seis telas.

## Publicação após a revisão

Correções publicadas no commit `83e8276`, release `27a55bc15c275c249d281378360b79ffa19f2a230942b345105b3ea0d6ef5534`. No domínio público, **27 Playwright passaram em 147,95 s**, sem falhas, testes ignorados ou instáveis; **19 verificações HTTP** aprovaram páginas, endpoints, erros esperados e cache. A evidência local acima preserva o estado histórico da revisão; [stage10-deployment.json](measurements/stage10-deployment.json) registra o estado efetivamente publicado.

## Correções encontradas e realizadas

1. **Navegação do perfil de Houston.** O item era destacado visualmente, mas `NavLink` não mantinha `aria-current` ao apontar para o caminho de Atlanta. O destaque e a página atual agora usam a mesma resolução da seção, com `Link` e atributo explícito.
2. **Foco atrás do menu móvel.** Tab alcançava controles encobertos. O conteúdo fica `inert` enquanto a navegação móvel está aberta; fechamento por Escape ou seleção restaura o foco após a atualização do DOM. A mudança para desktop remove a restrição.
3. **Contraste do histograma.** O preenchimento/contorno claro tinha razão mínima de aproximadamente **1,73:1**. Um contorno escuro preserva a paleta e delimita as barras, com razão medida de **6,30:1** contra o fundo. Textos SVG avaliados tiveram mínimo de **8,08:1**.
4. **Semântica dos nomes acessíveis.** Regiões roláveis de tabelas e grupos de controles/resumos agora têm papéis nomeáveis explícitos; pontos atípicos têm papel de imagem e descrição. Os avisos de atributos ARIA proibidos desapareceram na auditoria final.
5. **Unidades implícitas.** As tabelas de quartis e de evidências apresentam coluna de unidade. Histograma/KDE identificam a unidade do intervalo e a unidade inversa da densidade nos cabeçalhos.
6. **Lacunas interpretativas frente ao PDF.** Foram incluídos destaques de CV entre variáveis, maior magnitude de assimetria por time e coincidência/divergência desses padrões; justificativa do Fisher–Pearson ajustado, leitura dos bigodes em confronto com o sinal do coeficiente, centro típico e limites de transformações futuras.
7. **Evidência de robustez.** As leituras agora oferecem diagnóstico temporário de sensibilidade nas seis combinações com outliers IQR. Não se afirma que retirar pontos é corrigir erros nem se alteram as medidas oficiais.

Os problemas de seletor ambíguo e de encerramento de requisições interceptadas pertenciam aos novos testes, não ao produto. Os testes foram corrigidos para escolher o link do conteúdo e aguardar a conclusão dos mocks; não foram adicionados retries para ocultar falhas.

## Conferência científica independente

[verify_report.py](../../backend/scripts/verify_report.py) lê o CSV com `csv.DictReader` e confere seu SHA-256. Usa `statistics`, interpolação linear implementada separadamente e fórmula independente da assimetria para confrontar os resultados de produção; não chama os cálculos descritivos de produção para produzir os valores de referência.

São conferidos média, mediana, todas as modas/frequência, extremos, amplitude, variância/desvio amostrais, quartis, IQR, CV, IQR/mediana, assimetria, n/período e unidades. Matrizes CV/IQR e quadros de quartis são confrontados com a mesma referência independente. Os intervalos do histograma são conferidos observação por observação, incluindo fechamento do último intervalo e normalização da densidade.

Todos os vetores dos detectores são comparados com o CSV. Z-score e G observado de Grubbs usam conferência independente de média/desvio; a decisão de Grubbs preserva candidato/rejeição/empate. Os cortes relativos de scores são conferidos por quantil linear independente, o IQR por cercas recalculadas e o ruído DBSCAN pelo cluster −1. Isso verifica valores, decisões e registros; não afirma que quatro novos estimadores multivariados foram reimplementados independentemente. A validação anterior de ECOD e dos demais algoritmos continua na suíte científica.

Os testes de navegador abrem os 14 perfis e as 50 combinações de análise, verificam cada ID sinalizado/candidato e confrontam data, confronto, vetor de valores, score/cluster e decisão exibidos. Nos boxplots, conferem todos os marcadores de outliers e sua alternativa tabular. Valores oficiais continuam com todos os jogos: Atlanta 75 e Houston 74.

### Diagnóstico de sensibilidade

A remoção é **somente um cálculo auxiliar temporário**, usando as partidas estritamente fora das cercas originais de 1,5 × IQR. O cálculo auxiliar reutiliza as funções científicas Python; a auditoria o confere por `statistics`/quartis independentes. Fonte, detectores e resultados oficiais permanecem intactos, e o diagnóstico acompanha os filtros da leitura.

Exemplo real: REB de Atlanta tem um ponto fora da cerca. Sem esse ponto no diagnóstico, o desvio seria aproximadamente **6,55**, contra **6,82** no histórico completo, e o IQR permaneceria **9,00**. Em outras variáveis o IQR também muda; resistência a extremos não implica invariância absoluta. A amplitude/IQR também é comentada: 3× é apenas um guia exploratório explicitado no texto, distinto da regra de detecção 1,5×IQR.

## Acessibilidade, contexto e limites

A auditoria automática usa `@axe-core/playwright` **4.14.0**, fixado no lock como dependência de desenvolvimento. Foram usados os grupos WCAG A/AA disponibilizados pela ferramenta, com gráficos carregados. O retorno `incomplete` para contraste não foi tratado como aprovação automática: 708 elementos foram confrontados pelas cores sólidas computadas e pelos limites apropriados ao tamanho do texto. O contraste dos contornos dos gráficos foi verificado separadamente.

Também foram exercitados Tab, Enter, Escape, seleção por setas, link de salto ao conteúdo, retorno de foco, região rolável do gráfico e estrutura das tabelas. Os quatro valores modais de PTS de Houston permanecem visíveis; em STL de Atlanta, moda 9 e mediana 9 compartilham a coordenada horizontal e ocupam faixas verticais distintas.

As simulações de troca de release/versão, resposta incompatível, atraso e 503 alteram apenas o transporte nos testes. Não fabricam resultados científicos nem são publicadas. Anomalias continuam ajustadas ao histórico completo do próprio time; filtros HTTP afetam só exibição, e as telas sem barra global não herdam seleção oculta. Foram revisadas as convenções: medidas descritivas com duas casas, contagens inteiras, scores/cortes com até seis casas para preservar leitura de decisões próximas e densidades com precisão significativa identificada.

**Limites:** a revisão utiliza Chromium e não certifica conformidade WCAG integral, tampouco substitui testes com usuários ou NVDA/VoiceOver. Não mede completude externa do calendário, autenticidade de cada jogo, causalidade ou acurácia dos detectores sem rótulos. As correções foram publicadas após a revisão; a preparação e submissão finais permanecem na etapa 11. Permanecem os avisos conhecidos do chunk ECharts sob demanda e da depreciação do cliente de testes Starlette/httpx.

## Matriz R01–R24 revisada

| Requisitos | Situação após revisão | Evidência principal |
| --- | --- | --- |
| R01 | [X] Stack Python/FastAPI + React justificada e confirmada pelo grupo | Dados e métodos; jornada e auditoria de conteúdo |
| R02–R04 | [X] Conteúdo, seleção, gráficos/unidades/tabelas e contexto revisados com correções | Testes de navegador, teclado, contraste e API |
| R05 | [X] URL existente acessível; alternativa local documentada | Sete verificações públicas de leitura e README; revalidar na entrega |
| R06 | [ ] Parcial: revisão e identificação final da entrega/submissão pendentes | Etapa 11 e confirmação de envio pelo grupo |
| R07–R13 | [X] Dimensões, origem/limites, tipos, transformações, exclusões, qualidade e missingness apresentados | Dados e métodos, matriz, auditoria e jornada; nenhum teste de ausência fabricado |
| R14–R18 | [X] Domínios, sete métodos, medidas, boxplots e barras/referência padronizada conferidos | CSV, 50 análises, 14 perfis e registros no navegador |
| R19–R23 | [X] Assimetria, CV/IQR, comparações e robustez revisados e complementados | Destaques contextuais, diagnóstico e conferência independente |
| R24 | [X] Síntese da seleção separada de cobertura/confrontos completos | Jornada, filtros e testes de contexto/release |

A matriz detalhada em [requirements.md](../planning/requirements.md) foi atualizada por requisito; a existência de testes isoladamente não foi usada para fechar a submissão.

## Reproduzir

Com Python 3.12/uv e Node 24 preparados:

```bash
make data-build
make check
make report-audit
make data-validate
make api-contracts
make web-check
make web-e2e
```

Os testes usam servidores próprios em 8018/4178 e os encerram ao terminar; não reutilizam ou encerram servidores do usuário. O build dos dados gera um novo release; uma API já em execução deve ser reiniciada para carregar esse release, conforme a política de snapshot.

Para JSON completo do navegador, sem o cabeçalho do npm:

```bash
npm --silent run test:e2e --prefix frontend -- --reporter=json > data/processed/stage10-playwright.json
```

Referências primárias consultadas em 30/10/2026: [Playwright e testes de acessibilidade](https://playwright.dev/docs/accessibility-testing), [W3C: contraste de texto](https://www.w3.org/WAI/WCAG22/Understanding/contrast-minimum.html), [W3C: contraste não textual](https://www.w3.org/WAI/WCAG22/Understanding/non-text-contrast.html), [WAI-ARIA 1.2](https://www.w3.org/TR/wai-aria-1.2/), [SciPy: assimetria ajustada](https://docs.scipy.org/doc/scipy/reference/generated/scipy.stats.skew.html) e [NIST: medidas de localização e robustez](https://www.itl.nist.gov/div898/handbook/eda/section3/eda351.htm).
