"""Leituras descritivas vinculadas às medidas validadas, sem novo cálculo científico."""

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


def describe_results(results):
    readings = []
    for row in results:
        metric, team, n = row["metric"], row["team_id"], row["n"]
        stats = row["statistics"]
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
                "evidence": {
                    key: stats[key]["value"]
                    for key in ("mean", "median", "std", "cv", "q1", "q3", "iqr", "skewness")
                },
            }
        )
    return readings
