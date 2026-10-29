"""Contrato comum de referências, escores e decisões, sem dependência de HTTP."""

import numpy as np
import pandas as pd

from backend.analytics.descriptive import numeric_vector
from backend.analytics.metrics import get_metric


def team_reference(frame: pd.DataFrame, team_id: str) -> pd.DataFrame:
    rows = frame.loc[frame.team_id.eq(team_id)].sort_values(["game_date", "game_id"], kind="stable")
    if rows.game_id.duplicated().any():
        raise ValueError("Referência deve ter uma observação por time-partida.")
    return rows.reset_index(drop=True).copy()


def detection_result(rows, team_id, method, features, *, metric=None, parameters=None):
    n = len(rows)
    return {
        "method": method,
        "unit": get_metric(metric).unit if metric is not None else None,
        "feature_units": {code: get_metric(code).unit for code in features},
        "score_unit": {
            "zscore": "standard_deviations",
            "grubbs": "standard_deviations",
            "iqr": None,
            "ecod": "negative_log_tail_score",
            "lof": "relative_density_ratio",
            "knn": "euclidean_distance_in_preprocessed_space",
            "dbscan": None,
        }[method],
        "team_id": team_id,
        "metric": metric,
        "features": list(features),
        "status": "ok" if n else "empty",
        "reason": None if n else "Não há observações.",
        "reference_n": n,
        "display_n": n,
        "reference": {
            "team_id": team_id,
            "n": n,
            "scope": "provided_team_reference",
            "period": {
                "from": rows.game_date.min().isoformat(),
                "to": rows.game_date.max().isoformat(),
            }
            if n
            else None,
        },
        "parameters": parameters or {},
        "threshold": None,
        "score_direction": "higher_is_more_atypical",
        "outlier_count": None,
        "records": [],
        "warnings": [
            "Atipicidade não demonstra erro de coleta e não causa remoção automática.",
            "Scores têm referência própria do time; não são ranking absoluto entre times.",
        ],
    }


def attach_records(
    result, rows, features, *, scores=None, flags=None, raw_scores=None, extras=None
):
    extras = extras or [{} for _ in range(len(rows))]
    for i, row in enumerate(rows.itertuples(index=False)):
        result["records"].append(
            {
                "team_id": str(row.team_id),
                "game_id": str(row.game_id),
                "game_date": row.game_date.isoformat(),
                "matchup": str(row.matchup),
                "values": {
                    code: float(getattr(row, get_metric(code).canonical)) for code in features
                },
                "score": float(scores[i]) if scores is not None else None,
                "raw_score": float(raw_scores[i]) if raw_scores is not None else None,
                "is_outlier": bool(flags[i])
                if flags is not None and flags[i] is not None
                else None,
                **extras[i],
            }
        )
    if flags is not None and all(flag is not None for flag in flags):
        result["outlier_count"] = int(np.count_nonzero(flags))
    return result


def strict_quantile_cut(scores, quantile=0.95):
    if not 0 < quantile < 1:
        raise ValueError("Quantil deve estar estritamente entre 0 e 1.")
    values = numeric_vector(scores)
    if not len(values):
        raise ValueError("Não há escores para definir um limiar.")
    threshold = float(np.quantile(values, quantile, method="linear"))
    return threshold, values > threshold
