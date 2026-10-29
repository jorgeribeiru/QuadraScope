"""Sensibilidade exploratória; concordância não mede acurácia sem rótulos verdadeiros."""

import numpy as np
from scipy.stats import spearmanr

from backend.analytics.anomaly_contracts import team_reference
from backend.analytics.multivariate_anomalies import (
    knn_scores,
    multivariate_anomalies,
    prepare_features,
)
from backend.app.config import Settings, settings

NEIGHBOR_GRID = (5, 10, 15)
SCALER_GRID = ("standard", "robust")
EPS_GRID = (1.0, 1.5, 2.0, 2.5, 3.0)


def flagged_games(result):
    return {row["game_id"] for row in result["records"] if row["is_outlier"] is True}


def jaccard(left, right):
    union = left | right
    return len(left & right) / len(union) if union else 1.0


def _rho(left, right):
    if left is None or right is None or np.ptp(left) == 0 or np.ptp(right) == 0:
        return None
    value = float(spearmanr(left, right).statistic)
    return value if np.isfinite(value) else None


def _compact(result):
    return {
        "status": result["status"],
        "reason": result["reason"],
        "parameters": result["parameters"],
        "threshold": result["threshold"],
        "outlier_count": result["outlier_count"],
        "flagged_game_ids": sorted(flagged_games(result)),
        "clusters": result.get("clusters"),
        "observations": [
            {
                "game_id": r["game_id"],
                "score": r["score"],
                "is_outlier": r["is_outlier"],
                "cluster": r.get("cluster"),
            }
            for r in result["records"]
        ],
    }


def k_distance_knee(rows, features):
    if len(rows) < 20:
        return {"distance": None, "reason": "Referência insuficiente."}
    x, _ = prepare_features(rows, features, "standard")
    if not x.shape[1]:
        return {"distance": None, "reason": "Todas as dimensões constantes."}
    scores, _ = knn_scores(x, 4)  # min_samples=5 conta o próprio ponto.
    ordered = np.sort(scores)
    span = float(np.ptp(ordered))
    if span == 0:
        index = len(ordered) // 2
    else:
        normalized = (ordered - ordered[0]) / span
        index = int(np.argmax(np.linspace(0, 1, len(ordered)) - normalized))
    return {
        "distance": float(ordered[index]),
        "index": index,
        "sorted_distances": ordered.tolist(),
        "neighbor_k_excluding_self": 4,
        "rule": "maximum_gap_below_normalized_endpoint_chord",
        "reason": None,
    }


def sensitivity_report(frame, config: Settings = settings) -> dict:
    teams, knees = [], []
    for team in config.team_ids:
        rows = team_reference(frame, team)
        knee = k_distance_knee(rows, config.metrics)
        if knee["distance"] is not None:
            knees.append(knee["distance"])
        entry = {
            "team_id": team,
            "reference_n": len(rows),
            "neighbor_methods": {},
            "dbscan": [],
            "k_distance_knee": knee,
        }
        for method in ("knn", "lof"):
            baseline = multivariate_anomalies(
                frame, team, method, k=10, scaler="standard", config=config
            )
            base_scores = (
                [r["score"] for r in baseline["records"]] if baseline["status"] == "ok" else None
            )
            variants = []
            for scaler in SCALER_GRID:
                for k in NEIGHBOR_GRID:
                    result = multivariate_anomalies(
                        frame, team, method, k=k, scaler=scaler, config=config
                    )
                    scores = (
                        [r["score"] for r in result["records"]]
                        if result["status"] == "ok"
                        else None
                    )
                    variants.append(
                        {
                            **_compact(result),
                            "scaler": scaler,
                            "k": k,
                            "spearman_vs_standard_k10": _rho(base_scores, scores),
                            "flag_jaccard_vs_standard_k10": jaccard(
                                flagged_games(baseline), flagged_games(result)
                            )
                            if result["status"] == baseline["status"] == "ok"
                            else None,
                        }
                    )
            comparisons = [v for v in variants if not (v["scaler"] == "standard" and v["k"] == 10)]
            correlations = [
                v["spearman_vs_standard_k10"]
                for v in comparisons
                if v["spearman_vs_standard_k10"] is not None
            ]
            overlaps = [
                v["flag_jaccard_vs_standard_k10"]
                for v in comparisons
                if v["flag_jaccard_vs_standard_k10"] is not None
            ]
            entry["neighbor_methods"][method] = {
                "baseline": {"scaler": "standard", "k": 10},
                "variants": variants,
                "stability": {
                    "min_spearman": min(correlations) if correlations else None,
                    "median_spearman": float(np.median(correlations)) if correlations else None,
                    "min_flag_jaccard": min(overlaps) if overlaps else None,
                    "median_flag_jaccard": float(np.median(overlaps)) if overlaps else None,
                },
            }
        for scaler in SCALER_GRID:
            previous = None
            for eps in EPS_GRID:
                result = multivariate_anomalies(
                    frame, team, "dbscan", scaler=scaler, eps=eps, min_samples=5, config=config
                )
                current = flagged_games(result)
                entry["dbscan"].append(
                    {
                        **_compact(result),
                        "scaler": scaler,
                        "eps": eps,
                        "noise_fraction": result["outlier_count"] / len(rows)
                        if result["outlier_count"] is not None
                        else None,
                        "noise_jaccard_vs_previous_eps": jaccard(previous, current)
                        if previous is not None
                        else None,
                    }
                )
                previous = current if result["status"] == "ok" else None
        teams.append(entry)
    median_knee = float(np.median(knees)) if knees else None
    selected_eps = min(EPS_GRID, key=lambda eps: abs(eps - median_knee)) if knees else None
    return {
        "grids": {"k": list(NEIGHBOR_GRID), "scalers": list(SCALER_GRID), "eps": list(EPS_GRID)},
        "teams": teams,
        "selection": {
            "scaler": "standard",
            "neighbor_k": 10,
            "min_samples": 5,
            "dbscan_eps": selected_eps,
            "median_standard_4distance_knee": median_knee,
            "rule": "Nearest eps to median standardized 4-distance knee; ties choose lower.",
            "neighbor_reason": (
                "k=10 é intermediário pré-especificado; RobustScaler testa sensibilidade, "
                "sem buscar rótulos desejados."
            ),
        },
        "limitations": [
            "Sem rótulos verdadeiros, correlação e Jaccard não medem acurácia.",
            "Concordância não garante validade; discordância é limitação a reportar.",
            "Configuração DBSCAN não é escolhida para obter uma quantidade desejada de ruído.",
            "Resultados exploratórios do snapshot; não estimam desempenho futuro.",
        ],
    }
