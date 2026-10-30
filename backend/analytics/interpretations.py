"""Leituras descritivas vinculadas às medidas validadas, sem novo cálculo científico."""

from backend.analytics.descriptive import describe_values
from backend.analytics.metrics import get_metric

TEAM_NAMES = {"1610612737": "Atlanta Hawks", "1610612745": "Houston Rockets"}
MEANINGS = {
    "PTS": (
        "Pontos medem volume por partida, sem ajuste por posses ou minutos; não são "
        "eficiência ofensiva."
    ),
    "REB": (
        "Rebotes dependem das oportunidades de disputa; o total não distingue "
        "eficiência no rebote ofensivo e defensivo."
    ),
    "AST": (
        "Assistências descrevem passes convertidos em cestas, sem medir sozinhas ritmo "
        "ou qualidade causal da circulação."
    ),
    "STL": (
        "Roubos são contagens pequenas: uma unidade pode alterar bastante o CV. Não "
        "resumem toda a defesa."
    ),
    "BLK": (
        "Tocos são contagens pequenas e discretas; média baixa amplifica o CV. Zero "
        "pode ser um resultado legítimo."
    ),
    "PF": (
        "Faltas descrevem eventos registrados; menor média não demonstra, isoladamente, "
        "melhor defesa ou arbitragem diferente."
    ),
    "FG3M": (
        "Cestas de três medem volume convertido. Sem considerar as tentativas, não "
        "representam aproveitamento."
    ),
}


def number(value):
    return f"{value:,.2f}".replace(",", "_").replace(".", ",").replace("_", ".")


def describe_results(results, games=None):
    readings = []
    for row in results:
        metric, team, n = row["metric"], row["team_id"], row["n"]
        stats = row["statistics"]
        diagnostic = None
        parts = [f"{TEAM_NAMES[team]} · {get_metric(metric).label}: {n} jogos nesta seleção."]
        if not n:
            parts.append("Sem observações; não há conclusão sobre nível ou regularidade.")
        else:
            for key, label in [
                ("mean", "Média"),
                ("median", "mediana"),
                ("std", "desvio amostral"),
            ]:
                item = stats[key]
                if item["value"] is not None:
                    parts.append(f"{label}: {number(item['value'])} {item['unit']}.")
            cv = stats["cv"]
            if cv["value"] is not None:
                parts.append(
                    f"CV de {number(cv['value'])}% descreve dispersão relativa à média; "
                    "não há um corte universal de regularidade."
                )
            else:
                parts.append(f"CV indisponível: {cv['reason']}")
            iqr = stats["iqr"]["value"]
            parts.append(
                f"Os 50% centrais vão de {number(stats['q1']['value'])} a "
                f"{number(stats['q3']['value'])} {row['unit']} (IQR {number(iqr)}); "
                f"a amplitude total é {number(stats['range']['value'])} {row['unit']}. "
                "IQR descreve o centro e amplitude descreve extremos; nenhum substitui o desvio."
            )
            classification = row["skewness_classification"]
            if classification:
                direction = {"left": "à esquerda", "right": "à direita", "neutral": "neutra"}
                intensity = {
                    "approximately_symmetric": "aproximadamente simétrica",
                    "moderate": "moderada",
                    "strong": "forte",
                }
                parts.append(
                    f"Assimetria ajustada {number(stats['skewness']['value'])}: "
                    f"direção {direction[classification['direction']]}, "
                    f"intensidade {intensity[classification['intensity']]}. "
                    "Confronte o coeficiente com histograma, KDE e boxplot; "
                    "não é teste de normalidade."
                )
            else:
                parts.append(f"Assimetria indisponível: {stats['skewness']['reason']}")
            parts.append(
                f"O boxplot identifica {row['boxplot']['outlier_count']} partidas fora das cercas "
                "de 1,5 × IQR, preservadas na análise. Sinalização não comprova erro."
            )
        if n:
            box = row["boxplot"]
            left_tail = box["q1"] - box["lower_whisker"]
            right_tail = box["upper_whisker"] - box["q3"]
            tail_sign = 1 if right_tail > left_tail else -1 if left_tail > right_tail else 0
            skew_value = stats["skewness"]["value"]
            parts.append(
                f"No boxplot, a extensão de Q1 ao bigode inferior é {number(left_tail)} "
                f"e de Q3 ao bigode superior é {number(right_tail)} {row['unit']}. "
            )
            if skew_value is not None:
                skew_sign = 1 if skew_value > 0 else -1 if skew_value < 0 else 0
                parts.append(
                    "O prolongamento dos bigodes concorda com o sinal do coeficiente."
                    if tail_sign == skew_sign and tail_sign != 0
                    else "Bigodes e coeficiente não exibem o mesmo desequilíbrio: quartis/bigodes "
                    "resumem o centro, enquanto o coeficiente usa distâncias cúbicas e inclui "
                    "os pontos além das cercas. Classes do histograma e suavização KDE também "
                    "alteram a aparência das caudas."
                )
                parts.append(
                    "Com assimetria forte, prefira a mediana para descrever um centro resistente "
                    "a extremos; mantenha a média como volume médio observado. Uma transformação "
                    "logarítmica poderia ser estudada futuramente, mas log(0) não é definido e "
                    "não se aplica automaticamente log(x+1) sem justificar a nova escala."
                    if abs(skew_value) >= 1
                    else "A assimetria não é forte pelo critério declarado. Leia média e mediana "
                    "em conjunto: a média resume volume e a mediana resiste mais aos extremos; "
                    "isso não demonstra normalidade."
                )
            if stats["iqr"]["value"] > 0:
                ratio = stats["range"]["value"] / stats["iqr"]["value"]
                parts.append(
                    f"A amplitude equivale a {number(ratio)} vezes o IQR. "
                    + (
                        "Ultrapassa 3 × IQR, guia exploratório declarado para destacar distância "
                        "entre extremos e centro, sem classificar erro ou significância."
                        if ratio >= 3
                        else "Não ultrapassa o guia exploratório de 3 × IQR; "
                        "não se força evidência de extremos dominantes."
                    )
                )
            if games is not None and box["outlier_count"]:
                excluded = {point["game_id"] for point in box["outliers"]}
                own = [game for game in games if game["team_id"] == team]
                if len(own) != n:
                    raise ValueError("Diagnóstico e leitura devem usar a mesma seleção.")
                values = [
                    game[get_metric(metric).canonical]
                    for game in own
                    if game["game_id"] not in excluded
                ]
                core = describe_values(values, row["unit"])["statistics"]
                diagnostic = {
                    "scope": "temporary_iqr_sensitivity_no_official_rows_removed",
                    "excluded_game_ids": sorted(excluded),
                    "retained_n": len(values),
                    "original_std": stats["std"]["value"],
                    "retained_std": core["std"]["value"],
                    "original_iqr": stats["iqr"]["value"],
                    "retained_iqr": core["iqr"]["value"],
                }
                if core["std"]["value"] is not None:
                    parts.append(
                        f"Diagnóstico de sensibilidade: sem as {len(excluded)} partidas além "
                        f"das cercas originais, o desvio seria {number(core['std']['value'])} "
                        f"em vez de {number(stats['std']['value'])}; IQR seria "
                        f"{number(core['iqr']['value'])} "
                        f"em vez de {number(stats['iqr']['value'])}. "
                        "A comparação é temporária, não remove linhas nem substitui medidas "
                        "oficiais. IQR também pode mudar; resistência a extremos não significa "
                        "invariância universal."
                    )
            else:
                parts.append(
                    "Sem diagnóstico de retirada de outliers nesta leitura; "
                    "não se afirma que o desvio foi inflado por erros."
                )
        parts.append(MEANINGS[metric])
        parts.append(
            "São totais observados, com prorrogações preservadas, sem ajuste pelo calendário. "
            "Diferenças não identificam causalidade nem superioridade global."
        )
        readings.append(
            {
                "team_id": team,
                "metric": metric,
                "n": n,
                "text": " ".join(parts),
                "sensitivity_diagnostic": diagnostic,
                "evidence": {
                    key: stats[key]["value"]
                    for key in ("mean", "median", "std", "cv", "q1", "q3", "iqr", "skewness")
                },
            }
        )
    return readings
