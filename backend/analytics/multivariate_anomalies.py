"""ECOD, k-NN, LOF e DBSCAN sobre referência separada de cada time."""

import math

import numpy as np
from sklearn.cluster import DBSCAN
from sklearn.neighbors import LocalOutlierFactor, NearestNeighbors
from sklearn.preprocessing import RobustScaler, StandardScaler

from backend.analytics.anomaly_contracts import (
    attach_records,
    detection_result,
    strict_quantile_cut,
    team_reference,
)
from backend.analytics.ecod import REFERENCE_COMMIT, ecod_scores, numeric_matrix
from backend.analytics.metrics import feature_columns
from backend.app.config import Settings, settings


def knn_scores(values, k=10):
    x = numeric_matrix(values)
    if not isinstance(k, int) or not 1 <= k < len(x):
        raise ValueError("k deve ser inteiro, positivo e menor que n.")
    model = NearestNeighbors(n_neighbors=k + 1, algorithm="brute", metric="euclidean").fit(x)
    distances, indices = model.kneighbors(x)
    neighbors = [indices[i][indices[i] != i][:k] for i in range(len(x))]
    scores = np.array([distances[i][indices[i] != i][:k][-1] for i in range(len(x))])
    return scores, neighbors


def prepare_features(rows, features, scaler):
    if scaler not in {"standard", "robust", "none"}:
        raise ValueError("Escalonamento deve ser standard, robust ou none.")
    x = numeric_matrix(rows.loc[:, list(feature_columns(tuple(features)))])
    active = np.ptp(x, axis=0) > 0
    used = [feature for feature, keep in zip(features, active, strict=True) if keep]
    excluded = [feature for feature, keep in zip(features, active, strict=True) if not keep]
    info = {
        "input_features": list(features),
        "features_used": used,
        "excluded_constant_features": excluded,
        "scaler": scaler,
        "fitted_on": "full_team_reference",
        "center": None,
        "scale": None,
    }
    if not active.any():
        return x[:, active], info
    x = x[:, active]
    if scaler == "none":
        return x, info
    transformer = (
        StandardScaler() if scaler == "standard" else RobustScaler(quantile_range=(25, 75))
    )
    scaled = transformer.fit_transform(x)
    center = transformer.mean_ if scaler == "standard" else transformer.center_
    info.update(center=center.tolist(), scale=transformer.scale_.tolist())
    info["convention"] = "population_std_ddof0" if scaler == "standard" else "median_and_IQR_linear"
    return scaled, info


def multivariate_anomalies(
    frame,
    team_id,
    method,
    *,
    scaler="standard",
    k=10,
    eps=2.0,
    min_samples=5,
    quantile=0.95,
    min_reference_n=20,
    config: Settings = settings,
):
    if method not in {"ecod", "knn", "lof", "dbscan"}:
        raise ValueError(f"Método multivariado desconhecido: {method}.")
    if not 0 < quantile < 1 or min_reference_n < 2 or not isinstance(k, int) or k < 1:
        raise ValueError("Quantil, amostra mínima ou k inválidos.")
    if not math.isfinite(eps) or eps <= 0 or not isinstance(min_samples, int) or min_samples < 2:
        raise ValueError("eps deve ser positivo e min_samples inteiro ≥2.")
    rows = team_reference(frame, team_id)
    features = config.metrics
    scaling = "none" if method == "ecod" else scaler
    result = detection_result(
        rows, team_id, method, features, parameters={"min_reference_n": min_reference_n}
    )
    if len(rows) < min_reference_n:
        if len(rows):
            result.update(
                status="insufficient_sample", reason=f"Mínimo operacional n≥{min_reference_n}."
            )
        return attach_records(result, rows, features)
    x, preprocessing = prepare_features(rows, features, scaling)
    result["parameters"]["preprocessing"] = preprocessing
    if not x.shape[1]:
        result.update(status="constant_series", reason="Todas as features são constantes.")
        return attach_records(result, rows, features)
    extras, raw_scores = None, None
    if method in {"knn", "lof"} and k >= len(rows):
        raise ValueError("k deve ser menor que o número de observações.")
    if method == "knn":
        scores, neighbors = knn_scores(x, k)
        extras = [
            {"neighbor_game_ids": rows.iloc[neighbor].game_id.astype(str).tolist()}
            for neighbor in neighbors
        ]
        result["parameters"].update(
            k=k,
            metric="euclidean",
            score="kth_other_neighbor_distance",
            self_excluded=True,
            algorithm="brute",
        )
    elif method == "lof":
        detector = LocalOutlierFactor(
            n_neighbors=k,
            novelty=False,
            contamination="auto",
            algorithm="brute",
            metric="euclidean",
        )
        library_labels = detector.fit_predict(x)
        raw_scores = detector.negative_outlier_factor_
        scores = -raw_scores
        extras = [{"library_label": int(label)} for label in library_labels]
        result["parameters"].update(
            k=k,
            novelty=False,
            score="-negative_outlier_factor_",
            library_offset=float(detector.offset_),
            algorithm="brute",
            final_labels="explicit_quantile_not_library_labels",
        )
    elif method == "ecod":
        ecod = ecod_scores(x)
        scores = ecod["scores"]
        used = preprocessing["features_used"]
        extras = [
            {
                "feature_contributions": {
                    feature: float(ecod["contributions"][i, j]) for j, feature in enumerate(used)
                },
                "tail_probabilities": {
                    feature: {
                        "left": float(ecod["left_probability"][i, j]),
                        "right": float(ecod["right_probability"][i, j]),
                    }
                    for j, feature in enumerate(used)
                },
            }
            for i in range(len(rows))
        ]
        result["parameters"].update(
            reference_commit=REFERENCE_COMMIT,
            skewness_bias=True,
            skewness_signs=ecod["skewness_signs"].tolist(),
            ties="inclusive_empirical_tail_probability",
            skewness_fallback_features=[used[i] for i in ecod["skewness_fallback_columns"]],
        )
    else:
        labels = DBSCAN(
            eps=eps, min_samples=min_samples, metric="euclidean", algorithm="brute"
        ).fit_predict(x)
        result["parameters"].update(
            eps=eps, min_samples=min_samples, metric="euclidean", algorithm="brute"
        )
        result["score_direction"] = "not_applicable"
        result["clusters"] = len(set(labels) - {-1})
        result["warnings"].append("Ruído DBSCAN depende da escala e parâmetros, não comprova erro.")
        if np.all(labels == -1) or np.all(labels != -1):
            result["warnings"].append(
                "Configuração produziu todo ruído ou nenhum ruído; não forçar clusters."
            )
        return attach_records(
            result,
            rows,
            features,
            flags=labels == -1,
            extras=[{"cluster": int(label)} for label in labels],
        )
    threshold, flags = strict_quantile_cut(scores, quantile)
    result["threshold"] = threshold
    result["parameters"].update(
        quantile=quantile, quantile_method="linear", comparison="score>threshold"
    )
    result["warnings"].append(
        "Corte relativo de cauda; não estima contaminação, erro ou probabilidade de anomalia."
    )
    return attach_records(
        result, rows, features, scores=scores, raw_scores=raw_scores, flags=flags, extras=extras
    )
