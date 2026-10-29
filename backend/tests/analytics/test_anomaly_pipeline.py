"""Sete métodos, sensibilidade real e invalidade da fonte bloqueiam publicação local."""

import json
from dataclasses import replace

import pytest

from backend.app.config import Settings, settings
from backend.scripts.detect_anomalies import detect_anomalies, load_parameters
from backend.scripts.export_sensitivity_review import export_sensitivity_review

pytestmark = pytest.mark.analytics


def test_reviewed_parameters_reject_a_different_snapshot():
    with pytest.raises(ValueError, match="snapshot"):
        load_parameters(replace(settings, expected_dataset_sha256="0" * 64))


def test_full_pipeline_and_sensitivity_then_invalid_input_removes_old_results(tmp_path):
    config = Settings(project_root=tmp_path)
    config.raw_data_dir.mkdir(parents=True)
    original = settings.dataset_path.read_bytes()
    config.dataset_path.write_bytes(original)
    status = detect_anomalies(config)
    assert status["status"] == "passed"
    assert status["result_count"] == 50
    report = json.loads((config.anomaly_dir / "anomalies.json").read_text())
    sensitivity = json.loads((config.anomaly_dir / "sensitivity.json").read_text())
    parameters = report["metadata"]["parameters"]
    assert report["metadata"]["source"]["sha256"] == settings.expected_dataset_sha256
    assert sensitivity["selection"]["dbscan_eps"] == parameters["dbscan_eps"] == 2.5
    assert sensitivity["selection"]["median_standard_4distance_knee"] == pytest.approx(
        2.3926644109581847
    )
    assert parameters["neighbor_k"] == 10
    assert len(report["results"]) == 50
    assert {r["method"] for r in report["results"]} == {
        "zscore",
        "iqr",
        "grubbs",
        "ecod",
        "knn",
        "lof",
        "dbscan",
    }
    for result in report["results"]:
        assert result["reference_n"] == result["display_n"] == len(result["records"])
        assert result["reference"]["scope"] == "full_team_history_in_dataset"
        assert all(row["team_id"] == result["team_id"] for row in result["records"])
        assert result["status"] == "ok"
    for team in sensitivity["teams"]:
        assert len(team["dbscan"]) == 10
        for method in ("knn", "lof"):
            variants = team["neighbor_methods"][method]["variants"]
            assert len(variants) == 6
            baseline = next(v for v in variants if v["scaler"] == "standard" and v["k"] == 10)
            assert baseline["spearman_vs_standard_k10"] == pytest.approx(1)
            assert baseline["flag_jaccard_vs_standard_k10"] == 1
        assert team["k_distance_knee"]["neighbor_k_excluding_self"] == 4
    assert config.dataset_path.read_bytes() == original
    review = json.loads(export_sensitivity_review(config).read_text())
    assert review["report_version"] == "1.0.0"
    for team in review["teams"]:
        assert all("observations" not in variant for variant in team["dbscan"])
        assert len(team["dbscan"]) == 10
        assert all(
            "observations" not in variant
            for method in team["neighbor_methods"].values()
            for variant in method["variants"]
        )

    config.dataset_path.write_bytes(original + b"invalid-record\n")
    blocked = detect_anomalies(config)
    assert blocked["status"] == "blocked"
    assert not (config.anomaly_dir / "anomalies.json").exists()
    assert not (config.anomaly_dir / "sensitivity.json").exists()
    assert json.loads((config.anomaly_dir / "status.json").read_text())["status"] == "blocked"
