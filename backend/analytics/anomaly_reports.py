"""Configuração revisada e coleção dos métodos; funções sem leitura de dados."""

from backend.analytics.multivariate_anomalies import multivariate_anomalies
from backend.analytics.univariate_anomalies import univariate_anomalies
from backend.app.config import Settings, settings


def anomaly_reports(frame, parameters: dict, config: Settings = settings) -> dict:
    results = []
    for team in config.team_ids:
        for metric in config.metrics:
            for method in ("zscore", "iqr", "grubbs"):
                results.append(
                    univariate_anomalies(
                        frame,
                        team,
                        metric,
                        method,
                        z_threshold=parameters["z_threshold"],
                        iqr_k=parameters["iqr_k"],
                        alpha=parameters["grubbs_alpha"],
                    )
                )
        for method in ("ecod", "knn", "lof", "dbscan"):
            results.append(
                multivariate_anomalies(
                    frame,
                    team,
                    method,
                    scaler=parameters["scaler"],
                    k=parameters["neighbor_k"],
                    eps=parameters["dbscan_eps"],
                    min_samples=parameters["dbscan_min_samples"],
                    quantile=parameters["score_quantile"],
                    min_reference_n=parameters["min_reference_n"],
                    config=config,
                )
            )
    for result in results:
        result["reference"]["scope"] = "full_team_history_in_dataset"
    return {
        "results": results,
        "summary": [
            {
                key: result[key]
                for key in (
                    "team_id",
                    "metric",
                    "features",
                    "method",
                    "status",
                    "reference_n",
                    "outlier_count",
                )
            }
            for result in results
        ],
    }
