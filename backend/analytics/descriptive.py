"""Estatísticas amostrais e boxplot: uma definição para tabelas, API e gráficos."""

import math

import numpy as np
import pandas as pd
from scipy.stats import skew

from backend.analytics.metrics import get_metric


def numeric_vector(values) -> np.ndarray:
    """Não descarta missing nem aceita NaN/infinito para obter um resultado aparente."""
    try:
        array = np.asarray(values, dtype=float)
    except (TypeError, ValueError) as error:
        raise ValueError("Observações devem ser numéricas, sem ausências.") from error
    if array.ndim != 1 or not np.isfinite(array).all():
        raise ValueError("Esperado vetor unidimensional de valores finitos, sem ausências.")
    return array


def measure(value, unit: str, method: str, *, status="ok", reason=None, parameters=None) -> dict:
    if isinstance(value, (int, float, np.number)):
        value = float(value)
        if not math.isfinite(value):
            value, status, reason = None, "not_applicable", "Resultado numérico não finito."
    return {
        "value": value,
        "status": status,
        "reason": reason,
        "unit": unit,
        "method": method,
        "parameters": parameters or {},
    }


def iqr_limits(values, k: float = 1.5) -> dict:
    if not math.isfinite(k) or k <= 0:
        raise ValueError("Multiplicador IQR deve ser finito e positivo.")
    x = numeric_vector(values)
    result = {
        "n": len(x),
        "method": "linear",
        "k": k,
        "q1": None,
        "median": None,
        "q3": None,
        "iqr": None,
        "lower_fence": None,
        "upper_fence": None,
    }
    if len(x):
        q1, median, q3 = np.quantile(x, [0.25, 0.5, 0.75], method="linear")
        width = q3 - q1
        result.update(
            {
                "q1": float(q1),
                "median": float(median),
                "q3": float(q3),
                "iqr": float(width),
                "lower_fence": float(q1 - k * width),
                "upper_fence": float(q3 + k * width),
            }
        )
    return result


def classify_skewness(coefficient: float) -> dict:
    if not math.isfinite(coefficient):
        raise ValueError("Coeficiente de assimetria deve ser finito.")
    magnitude = abs(coefficient)
    return {
        "direction": "right" if coefficient > 0 else "left" if coefficient < 0 else "neutral",
        "intensity": "approximately_symmetric"
        if magnitude < 0.5
        else "moderate"
        if magnitude < 1
        else "strong",
        "criteria": {
            "approximately_symmetric": "abs(G1)<0.5",
            "moderate": "0.5<=abs(G1)<1",
            "strong": "abs(G1)>=1",
        },
    }


def describe_values(values, unit: str = "unidades", *, ratio_scale: bool = True) -> dict:
    x = numeric_vector(values)
    n = len(x)
    bounds = iqr_limits(x)
    stats = {}
    definitions = {
        "mean": (unit, "arithmetic_mean"),
        "median": (unit, "quantile_linear"),
        "modes": (unit, "all_repeated_modes"),
        "minimum": (unit, "minimum"),
        "maximum": (unit, "maximum"),
        "range": (unit, "maximum_minus_minimum"),
        "variance": (f"({unit})²", "sample_variance"),
        "std": (unit, "sample_std"),
        "q1": (unit, "quantile_linear"),
        "q3": (unit, "quantile_linear"),
        "iqr": (unit, "q3_minus_q1"),
        "cv": ("%", "100*sample_std/mean"),
        "iqr_median_ratio": ("fração", "iqr/median"),
        "skewness": ("adimensional", "adjusted_fisher_pearson"),
    }
    for name, (stat_unit, method) in definitions.items():
        parameters = {"ddof": 1} if name in {"variance", "std", "cv"} else {}
        if name in {"median", "q1", "q3", "iqr"}:
            parameters = {"quantile_method": "linear"}
        if name == "skewness":
            parameters = {"implementation": "scipy.stats.skew", "bias": False}
        stats[name] = measure(
            None,
            stat_unit,
            method,
            status="empty",
            reason="Não há observações.",
            parameters=parameters,
        )
    stats["modes"].update(value=[], frequency=0)
    result = {
        "n": n,
        "statistics": stats,
        "iqr_limits": bounds,
        "skewness_classification": None,
        "warnings": [],
    }
    if not n:
        return result

    def set_value(name, value, status="ok", reason=None):
        stats[name].update(value=value, status=status, reason=reason)

    mean = float(np.mean(x))
    unique, counts = np.unique(x, return_counts=True)
    frequency = int(counts.max())
    modes = unique[counts == frequency].tolist() if frequency > 1 else []
    values = {
        "mean": mean,
        "median": bounds["median"],
        "minimum": float(x.min()),
        "maximum": float(x.max()),
        "range": float(np.ptp(x)),
        "q1": bounds["q1"],
        "q3": bounds["q3"],
        "iqr": bounds["iqr"],
    }
    for name, value in values.items():
        set_value(name, value)
    set_value(
        "modes",
        modes,
        "ok" if modes else "not_applicable",
        None if modes else "Nenhum valor se repete; convenção: sem moda repetida.",
    )
    stats["modes"]["frequency"] = frequency
    if ratio_scale and bounds["median"] > 0:
        set_value("iqr_median_ratio", bounds["iqr"] / bounds["median"])
    else:
        set_value(
            "iqr_median_ratio", None, "not_applicable", "Exige escala de razão e mediana positiva."
        )
    if n < 2:
        for name in ("variance", "std", "cv"):
            set_value(name, None, "insufficient_sample", "Desvio amostral exige n≥2.")
    else:
        variance, std = float(np.var(x, ddof=1)), float(np.std(x, ddof=1))
        set_value("variance", variance)
        set_value("std", std)
        if not ratio_scale or mean <= 0:
            set_value("cv", None, "not_applicable", "CV exige escala de razão e média positiva.")
        else:
            set_value("cv", 100 * std / mean)
            result["warnings"].append(
                "Interpretar CV com média, desvio, assimetria e granularidade; sem corte universal."
            )
    if n < 3:
        set_value("skewness", None, "insufficient_sample", "Assimetria ajustada exige n≥3.")
    elif unique.size == 1:
        set_value("skewness", None, "constant_series", "Assimetria indefinida em série constante.")
    else:
        coefficient = float(skew(x, bias=False, nan_policy="raise"))
        if math.isfinite(coefficient):
            set_value("skewness", coefficient)
            result["skewness_classification"] = classify_skewness(coefficient)
        else:
            set_value("skewness", None, "not_applicable", "Assimetria numericamente indefinida.")
    if bounds["iqr"] == 0:
        result["warnings"].append(
            "IQR zero: cercas coincidem; manter regra e interpretar sua degeneração."
        )
    # Falhas aritméticas não podem escapar como NaN/infinito no contrato JSON.
    for statistic in stats.values():
        value = statistic["value"]
        if isinstance(value, (float, int)) and not math.isfinite(value):
            statistic.update(
                value=None, status="not_applicable", reason="Resultado numérico não finito."
            )
    return result


def boxplot_payload(frame: pd.DataFrame, metric: str, description: dict) -> dict:
    spec = get_metric(metric)
    x = numeric_vector(frame[spec.canonical])
    if len(x) != description["n"]:
        raise ValueError("Boxplot e medidas devem usar a mesma população.")
    bounds, stats = description["iqr_limits"], description["statistics"]
    payload = {
        "status": "ok" if len(x) else "empty",
        "unit": spec.unit,
        **bounds,
        "mean": stats["mean"]["value"],
        "modes": stats["modes"]["value"],
        "mode_frequency": stats["modes"]["frequency"],
        "lower_whisker": None,
        "upper_whisker": None,
        "outliers": [],
        "outlier_count": 0,
    }
    if not len(x):
        return payload
    inside = (x >= bounds["lower_fence"]) & (x <= bounds["upper_fence"])
    payload["lower_whisker"] = float(x[inside].min())
    payload["upper_whisker"] = float(x[inside].max())
    for index in np.flatnonzero(~inside):
        row = frame.iloc[index]
        payload["outliers"].append(
            {
                "team_id": str(row.team_id),
                "game_id": str(row.game_id),
                "game_date": row.game_date.isoformat(),
                "matchup": str(row.matchup),
                "value": float(x[index]),
                "side": "lower" if x[index] < bounds["lower_fence"] else "upper",
            }
        )
    payload["outlier_count"] = len(payload["outliers"])
    return payload


def describe_team(frame: pd.DataFrame, team_id: str, metric: str) -> dict:
    spec = get_metric(metric)
    selected = frame.loc[frame.team_id.eq(team_id)]
    result = describe_values(selected[spec.canonical], spec.unit)
    result.update(
        {
            "team_id": team_id,
            "metric": metric,
            "unit": spec.unit,
            "period": {
                "from": selected.game_date.min().isoformat(),
                "to": selected.game_date.max().isoformat(),
            }
            if len(selected)
            else None,
        }
    )
    result["boxplot"] = boxplot_payload(selected, metric, result)
    return result
