"""IQR, Z-score e um teste bilateral de Grubbs, sem limpeza iterativa."""

import math

import numpy as np
from scipy.stats import t

from backend.analytics.anomaly_contracts import attach_records, detection_result, team_reference
from backend.analytics.descriptive import iqr_limits, numeric_vector
from backend.analytics.metrics import get_metric


def univariate_anomalies(frame, team_id, metric, method, *, z_threshold=3.0, iqr_k=1.5, alpha=0.05):
    if method not in {"zscore", "iqr", "grubbs"}:
        raise ValueError(f"Método univariado desconhecido: {method}.")
    if not math.isfinite(z_threshold) or z_threshold <= 0 or not 0 < alpha < 1:
        raise ValueError("Limiar Z deve ser positivo e alpha deve estar entre 0 e 1.")
    rows = team_reference(frame, team_id)
    x = numeric_vector(rows[get_metric(metric).canonical])
    limits = iqr_limits(x, iqr_k)
    result = detection_result(rows, team_id, method, [metric], metric=metric)
    n = len(x)
    if method == "iqr":
        result["parameters"] = {
            "k": iqr_k,
            "quantile_method": "linear",
            "comparison": "strict_outside_fences",
        }
        result["score_direction"] = "not_applicable"
        result["threshold"] = {"lower": limits["lower_fence"], "upper": limits["upper_fence"]}
        result["quartiles"] = limits
        if not n:
            return result
        flags = (x < limits["lower_fence"]) | (x > limits["upper_fence"])
        if limits["iqr"] == 0:
            result["warnings"].append(
                "IQR zero: manter cercas coincidentes; interpretar degeneração."
            )
        return attach_records(result, rows, [metric], flags=flags)
    result["parameters"] = {"ddof": 1}
    minimum = 2 if method == "zscore" else 3
    if n < minimum:
        if n:
            result.update(status="insufficient_sample", reason=f"Método exige n≥{minimum}.")
        return attach_records(result, rows, [metric])
    std = float(np.std(x, ddof=1))
    if std == 0:
        result.update(status="constant_series", reason="Desvio padrão zero.")
        return attach_records(result, rows, [metric])
    z = (x - np.mean(x)) / std
    scores = np.abs(z)
    if method == "zscore":
        result["parameters"].update(z_threshold=z_threshold, comparison="abs(z)>threshold")
        result["threshold"] = z_threshold
        return attach_records(
            result, rows, [metric], scores=scores, raw_scores=z, flags=scores > z_threshold
        )
    critical_t = float(t.ppf(1 - alpha / (2 * n), df=n - 2))
    critical = ((n - 1) / np.sqrt(n)) * np.sqrt(critical_t**2 / (n - 2 + critical_t**2))
    statistic = float(scores.max())
    candidates = scores == statistic
    rejected = bool(statistic > critical)
    tied = int(candidates.sum()) > 1
    result["threshold"] = float(critical)
    result["parameters"].update(
        alpha=alpha,
        sided="two_sided",
        iterative=False,
        classification="single_maximum_candidate",
        threshold_scope="global_test",
    )
    result["test"] = {
        "statistic": statistic,
        "critical_value": float(critical),
        "rejected": rejected,
        "candidate_game_ids": rows.loc[candidates, "game_id"].astype(str).tolist(),
        "attribution": "ambiguous_tie" if tied else "single_candidate",
    }
    result["warnings"].extend(
        [
            "Pressupõe normalidade aproximada; discutir gráficos e contagens discretas.",
            "Alpha é nominal por teste; 14 testes têm multiplicidade sem controle familiar a 5%.",
            "Grubbs avalia um extremo; não remover candidatos e repetir o procedimento.",
        ]
    )
    flags = [
        None if rejected and tied and candidate else bool(rejected and candidate)
        for candidate in candidates
    ]
    if tied:
        result["warnings"].append(
            "Extremos empatados não são rejeições independentes por observação."
        )
    return attach_records(
        result,
        rows,
        [metric],
        scores=scores,
        raw_scores=z,
        flags=flags,
        extras=[{"is_candidate": bool(candidate)} for candidate in candidates],
    )
