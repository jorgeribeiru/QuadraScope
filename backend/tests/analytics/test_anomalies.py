"""Regras numéricas, empates e vínculo dos detectores com a população de ajuste."""

from datetime import date, timedelta

import numpy as np
import pandas as pd
import pytest

from backend.analytics.anomaly_contracts import strict_quantile_cut
from backend.analytics.descriptive import describe_team
from backend.analytics.ingestion import ingest
from backend.analytics.metrics import get_metric
from backend.analytics.multivariate_anomalies import (
    knn_scores,
    multivariate_anomalies,
    prepare_features,
)
from backend.analytics.univariate_anomalies import univariate_anomalies
from backend.app.config import settings

pytestmark = pytest.mark.analytics


def sample_frame(values):
    frame = pd.DataFrame(
        {
            "team_id": [settings.team_ids[0]] * len(values),
            "game_id": [f"game-{i}" for i in range(len(values))],
            "game_date": [date(2026, 1, 1) + timedelta(days=i) for i in range(len(values))],
            "matchup": ["ATL vs. BOS"] * len(values),
        }
    )
    for metric in settings.metrics:
        frame[get_metric(metric).canonical] = values
    return frame


def test_zscore_uses_sample_std_and_explicit_signed_raw_score():
    frame = sample_frame([0] * 20 + [100])
    result = univariate_anomalies(frame, settings.team_ids[0], "PTS", "zscore")
    assert result["parameters"]["ddof"] == 1
    assert result["outlier_count"] == 1
    assert result["records"][-1]["is_outlier"] is True
    assert result["records"][-1]["raw_score"] == pytest.approx(20 / np.sqrt(21))
    assert result["records"][0]["raw_score"] < 0
    assert all(row["is_outlier"] == (row["score"] > 3) for row in result["records"])


@pytest.mark.parametrize(
    "values,status", [([], "empty"), ([1], "insufficient_sample"), ([2, 2, 2], "constant_series")]
)
def test_unavailable_zscore_is_not_reported_as_zero_anomalies(values, status):
    result = univariate_anomalies(sample_frame(values), settings.team_ids[0], "PTS", "zscore")
    assert result["status"] == status
    assert result["outlier_count"] is None
    assert all(row["score"] is None and row["is_outlier"] is None for row in result["records"])


def test_grubbs_two_sided_reproduces_reference_example_without_iteration():
    # Exemplo numérico NIST; testa o algoritmo, não representa partidas NBA.
    values = [199.31, 199.53, 200.19, 200.82, 201.92, 201.95, 202.18, 245.57]
    result = univariate_anomalies(sample_frame(values), settings.team_ids[0], "PTS", "grubbs")
    assert result["test"]["statistic"] == pytest.approx(2.4687, abs=0.0001)
    assert result["threshold"] == pytest.approx(2.126645, abs=0.000001)
    assert result["test"]["rejected"] is True
    assert result["test"]["candidate_game_ids"] == ["game-7"]
    assert result["parameters"]["iterative"] is False
    assert result["outlier_count"] == 1


def test_grubbs_tied_candidates_are_not_independent_rejections():
    result = univariate_anomalies(
        sample_frame([0] * 18 + [100, 100]), settings.team_ids[0], "PTS", "grubbs"
    )
    assert result["test"]["rejected"] is True
    assert result["test"]["attribution"] == "ambiguous_tie"
    assert result["outlier_count"] is None
    assert all(r["is_outlier"] is None for r in result["records"] if r["is_candidate"])


@pytest.mark.parametrize("values", [[0, 3, 4, 5, 8], [1, 1, 1, 1, 1, 5]])
def test_iqr_flags_match_boxplot_including_fences_and_zero_iqr(values):
    frame = sample_frame(values)
    result = univariate_anomalies(frame, settings.team_ids[0], "PTS", "iqr")
    box = describe_team(frame, settings.team_ids[0], "PTS")["boxplot"]
    assert {r["game_id"] for r in result["records"] if r["is_outlier"]} == {
        r["game_id"] for r in box["outliers"]
    }
    assert result["threshold"] == {"lower": box["lower_fence"], "upper": box["upper_fence"]}
    assert all(r["score"] is None for r in result["records"])


def test_neighbor_distance_excludes_self_even_for_duplicate_points():
    scores, neighbors = knn_scores([[0], [0], [10]], k=2)
    assert scores == pytest.approx([10, 10, 10])
    assert all(i not in selected for i, selected in enumerate(neighbors))
    assert knn_scores([[0], [1], [4], [10]], k=1)[0] == pytest.approx([1, 1, 3, 6])
    with pytest.raises(ValueError):
        knn_scores([[0], [1]], k=2)


def test_strict_score_quantile_does_not_force_five_percent_or_break_ties():
    cutoff, flags = strict_quantile_cut([1] * 75)
    assert cutoff == 1 and not flags.any()
    cutoff, flags = strict_quantile_cut([0, 1, 2], quantile=0.5)
    assert cutoff == 1 and flags.tolist() == [False, False, True]
    with pytest.raises(ValueError):
        strict_quantile_cut([1, 2], quantile=1)


@pytest.mark.parametrize("method", ["ecod", "knn", "lof", "dbscan"])
def test_multivariate_operational_minimum_and_all_constant_reference(method):
    result = multivariate_anomalies(sample_frame(range(19)), settings.team_ids[0], method)
    assert result["status"] == "insufficient_sample" and result["outlier_count"] is None
    result = multivariate_anomalies(sample_frame([1] * 25), settings.team_ids[0], method)
    assert result["status"] == "constant_series" and result["outlier_count"] is None
    assert len(result["parameters"]["preprocessing"]["excluded_constant_features"]) == 7


def test_preprocessing_records_fit_population_and_excludes_only_constant_features():
    frame = sample_frame(range(25))
    frame["blocks"] = 4
    matrix, info = prepare_features(frame, settings.metrics, "standard")
    assert matrix.shape == (25, 6)
    assert info["excluded_constant_features"] == ["BLK"]
    assert np.mean(matrix, axis=0) == pytest.approx(np.zeros(6), abs=1e-12)
    assert np.std(matrix, axis=0, ddof=0) == pytest.approx(np.ones(6))
    assert info["convention"] == "population_std_ddof0"
    assert info["center"][0] == 12
    frame.loc[0, "points"] = float("nan")
    with pytest.raises(ValueError):
        prepare_features(frame, settings.metrics, "robust")


@pytest.mark.parametrize("eps,noise", [(1e-9, 25), (100, 0)])
def test_dbscan_all_noise_and_no_noise_are_valid_outputs_without_scores(eps, noise):
    result = multivariate_anomalies(
        sample_frame(range(25)), settings.team_ids[0], "dbscan", eps=eps
    )
    assert result["outlier_count"] == noise
    assert result["threshold"] is None and result["score_direction"] == "not_applicable"
    assert all(r["score"] is None and r["raw_score"] is None for r in result["records"])
    assert result["clusters"] == (0 if noise == 25 else 1)


@pytest.mark.parametrize("method", ["ecod", "knn", "lof", "dbscan"])
def test_reference_row_order_cannot_change_keyed_detections(method):
    frame = sample_frame([*range(24), 100])
    first = multivariate_anomalies(frame, settings.team_ids[0], method)
    second = multivariate_anomalies(
        frame.sample(frac=1, random_state=42), settings.team_ids[0], method
    )
    assert first == second


def test_real_lof_and_ecod_expose_correct_scores_and_single_team_reference():
    focus = ingest().focus
    for method in ("ecod", "knn", "lof"):
        result = multivariate_anomalies(focus, settings.team_ids[0], method)
        assert result["reference_n"] == result["display_n"] == 75
        assert len(result["records"]) == 75
        assert all(r["team_id"] == settings.team_ids[0] for r in result["records"])
        assert all(r["is_outlier"] == (r["score"] > result["threshold"]) for r in result["records"])
        if method == "lof":
            assert result["parameters"]["novelty"] is False
            assert all(
                r["score"] == -r["raw_score"] and r["library_label"] in {-1, 1}
                for r in result["records"]
            )
        if method == "ecod":
            assert result["parameters"]["preprocessing"]["scaler"] == "none"
            for row in result["records"]:
                assert sum(row["feature_contributions"].values()) == pytest.approx(row["score"])
    for team in settings.team_ids:
        for metric in settings.metrics:
            result = univariate_anomalies(focus, team, metric, "iqr")
            box = describe_team(focus, team, metric)["boxplot"]
            assert result["outlier_count"] == box["outlier_count"]
            assert {r["game_id"] for r in result["records"] if r["is_outlier"]} == {
                r["game_id"] for r in box["outliers"]
            }
