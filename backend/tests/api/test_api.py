"""Contratos HTTP, equivalência das seleções e referência científica dos detectores."""

import json
import shutil
from dataclasses import replace
from statistics import mean, variance

import pytest
from fastapi.testclient import TestClient

from backend.app.config import Settings, settings
from backend.app.main import create_app
from backend.artifacts.build import build_dataset
from backend.artifacts.serialization import canonical_bytes
from backend.repositories.artifacts import ArtifactRepository

pytestmark = pytest.mark.api
PREFIX = "/api/v1"
ATL, HOU = settings.team_ids


@pytest.fixture(scope="module")
def dataset(tmp_path_factory):
    config = Settings(project_root=tmp_path_factory.mktemp("api"))
    config.raw_data_dir.mkdir(parents=True)
    config.dataset_path.write_bytes(settings.dataset_path.read_bytes())
    build_dataset(config)
    return config


@pytest.fixture(scope="module")
def repository(dataset):
    return ArtifactRepository(config=dataset)


@pytest.fixture(scope="module")
def client(dataset):
    with TestClient(create_app(dataset)) as current:
        yield current


def get(client, path, params=None, status=200):
    response = client.get(PREFIX + path, params=params)
    assert response.status_code == status, response.text
    assert "NaN" not in response.text and "Infinity" not in response.text
    return response.json()


def test_metadata_dictionary_and_primary_vs_context_teams(client):
    health = get(client, "/health")
    meta = get(client, "/meta")
    assert health["release_id"] == meta["context"]["release_id"]
    assert meta["source"]["row_count"] == 2238
    assert len(meta["metrics"]) == 7
    assert len(get(client, "/dictionary")["columns"]) == 28
    teams = get(client, "/teams")["teams"]
    assert len(teams) == 30 and sum(t["n"] for t in teams) == 2238
    primary = [t for t in teams if t["role"] == "primary"]
    assert {t["team_id"] for t in primary} == {ATL, HOU}
    assert {t["abbreviation"] for t in primary} == {"ATL", "HOU"}
    assert all(t["role"] == "context" for t in teams if t["team_id"] not in {ATL, HOU})


@pytest.mark.parametrize("team", [ATL, HOU])
def test_full_history_matches_precomputed_reports(client, repository, team):
    actual = get(client, f"/teams/{team}/summary")
    expected = [r for r in repository.get("descriptives.json")["results"] if r["team_id"] == team]
    assert actual["results"] == expected
    assert actual["context"]["reference_scope"] == "filtered_selection"
    assert actual["context"]["n_by_team"][team] == (75 if team == ATL else 74)


def independently_select(rows, team, params):
    return [
        r
        for r in rows
        if r["team_id"] == team
        and ("from" not in params or r["game_date"] >= params["from"])
        and ("to" not in params or r["game_date"] <= params["to"])
        and (params.get("venue", "all") == "all" or r["venue"] == params["venue"])
        and (params.get("outcome", "all") == "all" or r["won"] == (params["outcome"] == "win"))
    ]


@pytest.mark.parametrize(
    "params",
    [
        {"venue": "home"},
        {"venue": "away", "outcome": "win"},
        {"from": "2026-01-01", "to": "2026-01-31", "outcome": "loss"},
        {"from": "2099-01-01"},
        {"from": "2025-10-21", "to": "2025-10-21"},
    ],
)
def test_filters_have_identical_populations_and_manual_measures_across_endpoints(
    client, repository, params
):
    rows = repository.get("games.json")["rows"]
    comparisons = get(client, "/comparisons", params)
    for team in (ATL, HOU):
        expected = independently_select(rows, team, params)
        summary = get(client, f"/teams/{team}/summary", params)
        distribution = get(client, "/distributions", {**params, "team_id": team, "metric": "PTS"})
        anomalies = get(client, "/anomalies", {**params, "team_id": team, "method": "lof"})
        for response in (comparisons, summary, distribution, anomalies):
            assert response["context"]["n_by_team"][team] == len(expected)
            assert response["context"]["filters"]["venue"] == params.get("venue", "all")
        points = next(r for r in summary["results"] if r["metric"] == "PTS")
        assert distribution["description"] == points
        assert distribution["distribution"]["teams"][0]["n"] == len(expected)
        assert sum(distribution["distribution"]["teams"][0]["histogram"]["counts"]) == len(expected)
        assert {r["game_id"] for r in anomalies["result"]["records"]} == {
            r["game_id"] for r in expected
        }
        compared = next(
            r for r in comparisons["summary"] if r["team_id"] == team and r["metric"] == "PTS"
        )
        assert compared["statistics"] == points["statistics"]
        if expected:
            assert points["statistics"]["mean"]["value"] == pytest.approx(
                mean(r["points"] for r in expected)
            )
        else:
            assert points["statistics"]["mean"]["value"] is None
            assert points["statistics"]["mean"]["status"] == "empty"
            assert summary["context"]["status"] == "empty"
        if len(expected) > 1:
            assert points["statistics"]["variance"]["value"] == pytest.approx(
                variance(r["points"] for r in expected)
            )


@pytest.mark.parametrize("team", [ATL, HOU])
def test_inclusive_dates_single_record_and_measure_states(client, repository, team):
    row = next(r for r in repository.get("games.json")["rows"] if r["team_id"] == team)
    params = {"from": row["game_date"], "to": row["game_date"]}
    response = get(client, f"/teams/{team}/summary", params)
    assert response["context"]["n_by_team"][team] == 1
    points = next(r for r in response["results"] if r["metric"] == "PTS")
    assert points["statistics"]["mean"]["value"] == row["points"]
    assert points["statistics"]["std"]["value"] is None
    assert points["statistics"]["std"]["status"] == "insufficient_sample"
    distribution = get(client, "/distributions", {**params, "team_id": team, "metric": "PTS"})
    kde = distribution["distribution"]["teams"][0]["kde"]
    assert kde["status"] == "insufficient_sample" and kde["density"] == []


@pytest.mark.parametrize("team", [ATL, HOU])
@pytest.mark.parametrize("method", ["zscore", "iqr", "grubbs", "knn", "lof", "dbscan", "ecod"])
def test_anomaly_filter_preserves_reference_scores_threshold_and_tests(
    client, repository, team, method
):
    params = {"team_id": team, "method": method}
    if method in {"zscore", "iqr", "grubbs"}:
        params["metric"] = "PTS"
    original = get(client, "/anomalies", params)["result"]
    filtered = get(client, "/anomalies", {**params, "venue": "home"})
    actual = filtered["result"]
    home = {
        r["game_id"]
        for r in repository.get("games.json")["rows"]
        if r["team_id"] == team and r["venue"] == "home"
    }
    assert actual["records"] == [r for r in original["records"] if r["game_id"] in home]
    for key in set(original) - {"records", "display_n"}:
        assert actual[key] == original[key]
    assert actual["reference_n"] == (75 if team == ATL else 74)
    assert actual["display_n"] == (38 if team == ATL else 35)
    assert filtered["context"]["reference_scope"] == "full_team_history_in_dataset"
    flags = [r["is_outlier"] for r in actual["records"]]
    assert filtered["display_outlier_count"] == (
        sum(flags) if all(f is not None for f in flags) else None
    )
    # Nenhuma mutação compartilhada após consultar uma seleção.
    assert get(client, "/anomalies", params)["result"] == original


def test_empty_anomaly_display_keeps_full_reference(client):
    body = get(client, "/anomalies", {"team_id": ATL, "method": "lof", "from": "2099-01-01"})
    assert body["context"]["status"] == "empty"
    assert body["result"]["reference_n"] == 75
    assert body["result"]["display_n"] == 0
    assert body["result"]["status"] == "ok"
    assert body["result"]["records"] == []
    assert body["display_outlier_count"] == 0


@pytest.mark.parametrize(
    "path,params,status",
    [
        ("/teams/999/summary", {}, 404),
        ("/teams/1610612738/summary", {}, 422),
        ("/teams/abc/summary", {}, 422),
        (f"/teams/{ATL}/summary", {"from": "2026-02-30"}, 422),
        (f"/teams/{ATL}/summary", {"from": "2026-01-01T00:00:00"}, 422),
        (f"/teams/{ATL}/summary", {"from": "2026-02-01", "to": "2026-01-01"}, 422),
        (f"/teams/{ATL}/summary", {"venue": "neutral"}, 422),
        (f"/teams/{ATL}/summary", {"outcome": "draw"}, 422),
        (f"/teams/{ATL}/summary", {"metric": "PTS"}, 422),
        ("/health", {"venue": "home"}, 422),
        ("/quality", {"from": "2026-01-01"}, 422),
        ("/distributions", {"team_id": ATL, "metric": "MIN"}, 422),
        ("/distributions", {"team_id": "999", "metric": "PTS"}, 404),
        ("/anomalies", {"team_id": ATL, "method": "unknown"}, 422),
        ("/anomalies", {"team_id": ATL, "method": "iqr"}, 422),
        ("/anomalies", {"team_id": ATL, "method": "iqr", "metric": "PTS", "features": "PTS"}, 422),
        ("/anomalies", {"team_id": ATL, "method": "lof", "metric": "PTS"}, 422),
        ("/anomalies", {"team_id": ATL, "method": "lof", "features": "PTS,REB"}, 422),
        ("/anomalies", {"team_id": ATL, "method": "lof", "k": "5"}, 422),
        ("/comparisons", {"team_ids": f"{ATL},{ATL}"}, 422),
        ("/comparisons", {"team_ids": f"{ATL},999"}, 422),
        ("/interpretations", {"context": "unknown"}, 422),
        ("/does-not-exist", {}, 404),
    ],
)
def test_invalid_queries_and_scope_have_explicit_error_contract(client, path, params, status):
    body = get(client, path, params, status)
    assert set(body) == {"error"}
    assert set(body["error"]) == {"code", "message", "details"}
    assert body["error"]["message"]


def test_repeated_query_parameters_are_rejected(client):
    get(client, f"/teams/{ATL}/summary", [("venue", "home"), ("venue", "away")], 422)


def test_multivariate_default_and_explicit_canonical_features_match(client):
    params = {"team_id": HOU, "method": "knn"}
    assert get(client, "/anomalies", params) == get(
        client, "/anomalies", {**params, "features": ",".join(settings.metrics)}
    )


def test_cache_identity_etag_and_parameter_normalization(client):
    response = client.get(PREFIX + f"/teams/{ATL}/summary")
    assert response.status_code == 200
    tag = response.headers["etag"]
    repeated = client.get(PREFIX + f"/teams/{ATL}/summary", headers={"If-None-Match": tag})
    assert repeated.status_code == 304 and repeated.content == b""
    filtered = client.get(
        PREFIX + f"/teams/{ATL}/summary", params={"venue": "home"}, headers={"If-None-Match": tag}
    )
    assert filtered.status_code == 200 and filtered.headers["etag"] != tag
    assert response.json()["context"]["cache_key"] != filtered.json()["context"]["cache_key"]
    default = get(client, "/comparisons")
    reversed_order = get(client, "/comparisons", {"team_ids": f"{HOU},{ATL}"})
    assert default == reversed_order


def test_quality_and_interpretations_use_actual_filtered_evidence(client):
    quality = get(client, "/quality")
    assert quality["context"]["reference_scope"] == "full_dataset"
    assert quality["report"]["status"] == "passed"
    interpretations = get(
        client, "/interpretations", {"context": "teams", "team_id": ATL, "venue": "home"}
    )
    assert interpretations["interpretation_status"] == "descriptive_available"
    assert all(
        row["team_id"] == ATL and row["n"] == 38 for row in interpretations["interpretations"]
    )
    summary = get(client, f"/teams/{ATL}/summary", {"venue": "home"})
    assert (
        interpretations["interpretations"][0]["evidence"]["mean"]
        == summary["results"][0]["statistics"]["mean"]["value"]
    )
    assert interpretations["context"]["n_by_team"][ATL] == 38
    assert interpretations["provenance"]["extracted_at"] is None


@pytest.mark.parametrize(
    "failure", ["missing_pointer", "version", "source", "corrupt", "missing_content"]
)
def test_unavailable_or_incompatible_artifacts_return_503_not_empty(dataset, tmp_path, failure):
    config = replace(dataset, project_root=tmp_path)
    shutil.copytree(dataset.processed_data_dir, config.processed_data_dir)
    repository = ArtifactRepository(config=config)
    if failure == "missing_pointer":
        config.current_pointer_path.unlink()
    elif failure == "version":
        config = replace(config, analysis_version="2.0.0")
    elif failure == "source":
        config = replace(config, expected_dataset_sha256="0" * 64)
    elif failure == "corrupt":
        (repository.release_path / "games.json").write_text("{}")
    else:
        (repository.release_path / "content.json").unlink()
    with TestClient(create_app(config)) as broken:
        for route in ("/health", f"/teams/{ATL}/summary", "/quality"):
            body = get(broken, route, status=503)
            assert body["error"]["code"] == "artifacts_unavailable"
        assert broken.get("/openapi.json").status_code == 200


def test_validated_repository_is_loaded_once_and_does_not_read_raw_csv(
    dataset, tmp_path, monkeypatch
):
    config = replace(dataset, project_root=tmp_path)
    shutil.copytree(dataset.processed_data_dir, config.processed_data_dir)
    assert not config.dataset_path.exists()
    with TestClient(create_app(config)) as running:
        before = get(running, "/health")
        config.current_pointer_path.unlink()
        assert get(running, "/health") == before
        get(running, f"/teams/{HOU}/summary", {"venue": "home"})
    with TestClient(create_app(config)) as restarted:
        get(restarted, "/health", status=503)


def test_cache_identity_changes_with_analysis_version(dataset, tmp_path):
    config = replace(dataset, project_root=tmp_path, analysis_version="1.0.1")
    config.raw_data_dir.mkdir(parents=True)
    config.dataset_path.write_bytes(settings.dataset_path.read_bytes())
    build_dataset(config)
    with TestClient(create_app(dataset)) as first, TestClient(create_app(config)) as second:
        old = get(first, "/comparisons")["context"]
        new = get(second, "/comparisons")["context"]
        assert old["dataset_sha256"] == new["dataset_sha256"]
        assert old["cache_key"] != new["cache_key"] and old["release_id"] != new["release_id"]


def test_openapi_matches_versioned_export_and_documents_errors_without_startup():
    from backend.app import schemas

    schema = create_app().openapi()
    exported = settings.project_root / "docs/api/openapi.json"
    assert exported.read_bytes() == canonical_bytes(schema)
    assert len(schema["paths"]) == 10
    assert all("requestBody" not in route["get"] for route in schema["paths"].values())
    for path in schema["paths"].values():
        assert set(path["get"]["responses"]) >= {"200", "304", "404", "422", "503"}
    assert "Context" in schema["components"]["schemas"]
    assert schemas.ErrorResponse.model_validate_json(
        json.dumps(
            {"error": {"code": "invalid_query", "message": "Consulta inválida.", "details": []}}
        )
    )


def test_parallel_requests_do_not_mix_team_or_filter_state(client):
    from concurrent.futures import ThreadPoolExecutor

    selections = [(ATL, "home", 38), (HOU, "home", 35), (ATL, "away", 37), (HOU, "all", 74)]

    def query(selection):
        team, venue, expected = selection
        result = get(client, f"/teams/{team}/summary", {"venue": venue})
        assert result["context"]["n_by_team"] == {team: expected}
        assert all(row["team_id"] == team and row["n"] == expected for row in result["results"])
        return result["context"]["cache_key"]

    with ThreadPoolExecutor(max_workers=4) as pool:
        keys = list(pool.map(query, selections))
    assert len(set(keys)) == 4


@pytest.mark.parametrize(
    ("start", "end", "expected_n"),
    [("2099-01-01", "2099-01-02", 0), ("2025-10-22", "2025-10-22", 1)],
)
def test_interpretations_do_not_invent_regularity_with_empty_or_single_game(
    client, start, end, expected_n
):
    payload = get(
        client,
        "/interpretations",
        {
            "context": "teams",
            "team_id": ATL,
            "metric": "PTS",
            "from": start,
            "to": end,
        },
    )
    reading = payload["interpretations"][0]
    assert reading["n"] == expected_n
    assert reading["evidence"]["cv"] is None
    assert reading["evidence"]["std"] is None
    assert "CV de" not in reading["text"]
    assert ("Sem observações" if expected_n == 0 else "CV indisponível") in reading["text"]


def test_quality_inventory_separates_univariate_and_joint_anomalies(client):
    data = get(client, "/quality")
    inventory = data["anomaly_summary"]
    assert len(inventory) == 50
    for team, n in [(ATL, 75), (HOU, 74)]:
        own = [row for row in inventory if row["team_id"] == team]
        assert len(own) == 25
        assert all(row["reference_n"] == n for row in own)
        assert len([row for row in own if row["metric"] is None]) == 4
        expected = next(row for row in own if row["method"] == "lof")
        actual = get(client, "/anomalies", {"team_id": team, "method": "lof"})
        assert expected["outlier_count"] == actual["result"]["outlier_count"]


def test_iqr_sensitivity_is_contextual_and_does_not_remove_official_games(client):
    before = get(client, f"/teams/{ATL}/summary")
    reading = get(
        client,
        "/interpretations",
        {
            "context": "teams",
            "team_id": ATL,
            "metric": "REB",
        },
    )["interpretations"][0]
    diagnostic = reading["sensitivity_diagnostic"]
    assert reading["n"] == 75
    assert diagnostic["retained_n"] == 74
    assert len(diagnostic["excluded_game_ids"]) == 1
    assert diagnostic["original_iqr"] == diagnostic["retained_iqr"] == 9
    assert diagnostic["retained_std"] < diagnostic["original_std"]
    assert "temporária" in reading["text"] and "não remove linhas" in reading["text"]
    after = get(client, f"/teams/{ATL}/summary")
    assert before == after
    filtered = get(
        client,
        "/interpretations",
        {
            "context": "teams",
            "team_id": ATL,
            "metric": "REB",
            "venue": "home",
        },
    )["interpretations"][0]
    assert filtered["n"] == 38
