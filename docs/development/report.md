# Relatório web — etapa 9

O relatório apresenta Atlanta Hawks e Houston Rockets nas sete variáveis PTS, REB, AST, STL, BLK, PF e FG3M. Resultados científicos são calculados no Python; o navegador formata valores, aplica escalas gráficas e apresenta as evidências. P9.01–P9.12 estão implementados. A revisão integral de integração, acessibilidade e entrega permanece nas etapas 10–11.

## Localização das exigências

| Tela / seção | Conteúdo e referência | Requisitos |
| --- | --- | --- |
| Home — síntese | Comparação das sete médias, CV, leituras da variável selecionada e links à comparação com os mesmos filtros | R02, R21, R24 |
| Home — contexto completo | Cobertura, prorrogações e os dois confrontos diretos; escopo fixo explicitamente separado da seleção | R07, R24 |
| Perfil — medidas | Dois times, sete variáveis, 14 medidas por variável, n, período e unidades | R03, R16 |
| Perfil — boxplot | Q1/Q3, mediana, média, todas as modas, cercas, bigodes e partidas atípicas identificadas | R17, R22, R23 |
| Perfil — distribuição | Histograma em densidade, KDE Scott e suas tabelas; fórmula, direção e intensidade da assimetria ajustada | R19 |
| Perfil — leitura | Evidências da variável/time, CV com média/desvio/IQR/assimetria e limites do histórico | R02, R19–R23 |
| Comparação | Barras em unidade original/eixo zero, padronização e referência do z-score; boxplots em domínio comum | R04, R17–R19 |
| Comparação — dispersão | Matrizes CV/IQR 7×2, quartis 14×3, IQR/mediana, amplitude/desvio e discordâncias de ordenação | R20–R23 |
| Fora da curva | Sete métodos, dois times, escolha de variável univariada, scores/ruído, candidatos, parâmetros e inventário das 50 análises | R14, R15, R23 |
| Dados e métodos | Dimensões, origem, dicionário, transformações, exclusões, qualidade, missingness, teoria e stack | R01, R07–R14 |

Cada seção informa seus códigos de requisito. Esses códigos indicam onde localizar o conteúdo; não representam certificação de acessibilidade ou conclusão da submissão.

## Contexto e seleções

A barra global de data/mando/resultado/variável aparece **somente na Home e Comparação**. Links entre essas telas preservam a seleção. Perfis, Dados e métodos e Fora da curva não herdam filtros ocultos; queries antigas nessas rotas são normalizadas.

Perfis usam o histórico completo do próprio time no CSV. A variável é compartilhável no fragmento `#variavel=BLK`; a troca de time mantém essa variável. Anomalias usam fragmentos como `#time=1610612745&metodo=grubbs&variavel=BLK&partidas=all`. Métodos multivariados sempre usam as sete features; o fragmento de variável não é enviado à API nesses casos. Controles de exibição não reajustam o detector. Hashes são seleções de apresentação; não alteram a política de filtros globais.

As chaves de cache incluem release, versões, parâmetros e seleção. Resultados anteriores não são mantidos como placeholder. Textos contextuais chegam do mesmo release e da seleção enviada à API. Falhas na API são mostradas como erro; não são convertidas em zero, normalidade ou regularidade. Casos n=0/n=1 e medidas indefinidas mantêm seus motivos.

## Medidas e gráficos

As 14 medidas são média, mediana, todas as modas repetidas, mínimo, máximo, amplitude, variância amostral, desvio amostral, Q1, Q3, IQR, CV, IQR/mediana e assimetria ajustada. Quartis são lineares; variância/desvio usam n−1. A ausência de moda repetida não é substituída por uma moda arbitrária.

Boxplots e histogramas/KDE usam SVG, sem geração de imagens ou novo ajuste estatístico. Cercas e bigodes não se confundem: os bigodes são observações dentro das cercas, e a sinalização é estrita fora delas. Média, modas e partidas atípicas ocupam faixas verticais distintas para preservar medidas coincidentes. IDs/data/confronto/valores aparecem em tooltips e tabelas. Na comparação, os dois boxplots compartilham o domínio horizontal.

Histograma representa densidade em classes comuns, com contagens na tabela. KDE tem coordenadas, largura e fator Scott disponíveis. A suavização de contagens pode extrapolar o domínio; não estima a probabilidade de um valor inteiro exato. KDE indefinida não impede mostrar o histograma válido. Todos os gráficos têm descrição, unidades e alternativa tabular; rolagem é contida em telas menores.

Barras comparam médias na unidade original, eixo iniciado em zero. A discussão distingue uma possível referência conjunta para z-score de exibição, o desvio amostral do detector Z-score e o StandardScaler populacional dos métodos de vizinhança. Não são comparadas médias de z centradas separadamente por time.

## Interpretações e validade

[interpretations.py](../../backend/analytics/interpretations.py) redige leituras descritivas a partir dos resultados validados: n, média, mediana, desvio, CV, quartis, IQR, amplitude, assimetria e outliers. Inclui contexto específico para pontos, rebotes, assistências, roubos, tocos, faltas e cestas de três. A função não recalcula medidas nem ajusta detectores.

O build salva 14 leituras para o histórico completo. A validação exige correspondência entre leituras e evidências. `/interpretations` produz novamente as leituras quando os filtros mudam, restringindo time/variável quando solicitados; status `descriptive_available`. Para qualidade/metodologia, devolve apenas a documentação fixa, sem simular leituras filtradas.

A síntese compara médias observadas, sem teste de superioridade. A leitura de dispersão distingue CV, desvio, IQR e IQR/mediana e explicita discordâncias. BLK/STL exigem atenção à média pequena e contagens inteiras. Totais preservam prorrogações; nenhuma diferença é atribuída causalmente a elas. Dados completos do CSV e confrontos diretos ficam separados dos resultados filtrados.

## Métodos de anomalia

- Z-score, IQR e Grubbs analisam uma variável; os demais analisam o vetor completo. Inventário distingue 21 resultados univariados e quatro multivariados por time.
- ECOD, k-NN e LOF têm scores orientados e corte relativo estrito no quantil 0,95 linear. Não são probabilidades, acurácia ou um ranking entre times.
- LOF mostra decisão final por corte explícito, separada do rótulo automático. k-NN preserva vizinhos; ECOD expõe contribuições e probabilidades de cauda empírica.
- Grubbs preserva candidatos, G/crítico, rejeição e atribuição ambígua; não resolve empates inventando um outlier individual. Multiplicidade e normalidade aproximada estão declaradas.
- DBSCAN mostra cluster/ruído −1 e quantidade de clusters sem ruído, sem score contínuo fictício. Sensibilidade a escala, k, eps e limiar é discutida.

## Verificação

```bash
make check
make api-contracts
make data-build
make web-check
make web-e2e
```

Em 29/10/2026: 244 testes Python, 24 Vitest, lint/formatação, contratos TypeScript e build aprovados. Onze Playwright cobrem dados/qualidade, filtros, erros, navegação móvel, os 14 pares de perfis, sete métodos em ambos os times, seleção univariada, recarga dos fragmentos e leituras sob filtros/n=0/n=1. As verificações do navegador utilizam API e gráficos reais; não substituem a revisão completa da etapa 10.

[Plano](../planning/implementation-plan.md), [rastreabilidade](../planning/requirements.md) e [publicação](deployment.md).

A etapa 9 foi publicada no commit `c51acd9`, em https://quadrascope.vercel.app. Onze Playwright passaram sem login na versão pública. [Evidências do deployment e métricas](measurements/stage9-verification.json).
