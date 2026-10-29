"""Auditoria: erros bloqueiam dados enriquecidos e valores legítimos são preservados."""

import csv
import hashlib
import json
from dataclasses import replace
from datetime import date

import pandas as pd
import pytest

from backend.analytics.ingestion import ingest
from backend.analytics.missingness import missingness_report
from backend.analytics.quality import audit_quality
from backend.app.config import Settings, settings
from backend.scripts.audit_data import audit_data

pytestmark = pytest.mark.analytics


@pytest.fixture(scope="module")
def canonical():
    return ingest().canonical


@pytest.fixture
def pair(canonical):
    # Duas linhas reais do confronto ATL 86 × HOU 104 em 29/01/2026.
    return canonical[canonical.game_id.eq("22500682")].reset_index(drop=True).copy()


def check(report, rule):
    return next(item for item in report["checks"] if item["rule"] == rule)


def profile(report, original, scope="columns"):
    return next(item for item in report[scope] if item["original"] == original)


def test_real_quality_matches_audit_and_keeps_original_fields(canonical):
    report, enriched = audit_quality(canonical)

    assert report["status"] == "passed"
    assert report["failed_rules"] == []
    assert enriched.shape == (2238, 33)
    pd.testing.assert_frame_equal(enriched.loc[:, canonical.columns], canonical)
    assert sum(c["missing"] for c in report["columns"]) == 0
    assert sum(c["outside_domain"] for c in report["columns"]) == 0
    assert profile(report, "BLK")["zeros"] == 33
    assert profile(report, "STL")["zeros"] == 1
    assert profile(report, "BLK", "focus_columns")["zeros"] == 0
    assert profile(report, "Team_ID")["zeros"] is None
    assert profile(report, "Team_ID")["outliers"]["status"] == "not_applicable"
    assert profile(report, "PTS")["outliers"]["count"] is None
    assert report["duplicates"] == {"row_excess": 0, "key_excess": 0}
    assert check(report, "cumulative_unobserved_games")["count"] == 0
    assert check(report, "overtime_exposure")["count"] == 102
    coverage = report["coverage"]
    assert (coverage["rows"], coverage["teams"], coverage["unique_games"]) == (2238, 30, 1119)
    assert (coverage["focus"]["rows"], coverage["focus"]["unique_games"]) == (149, 147)
    assert coverage["focus"]["head_to_head_games"] == 2
    teams = {team["team_id"]: team for team in coverage["by_team"]}
    atl, hou = [teams[team] for team in settings.team_ids]
    assert (atl["rows"], atl["wins"], atl["home"], atl["away"], atl["overtime_games"]) == (
        75,
        42,
        38,
        37,
        2,
    )
    assert (hou["rows"], hou["wins"], hou["home"], hou["away"], hou["overtime_games"]) == (
        74,
        45,
        35,
        39,
        8,
    )


def test_pairing_is_keyed_and_reciprocal_even_with_reversed_rows(pair):
    report, enriched = audit_quality(pair.iloc[::-1])
    assert report["status"] == "passed"
    atl = enriched[enriched.team_id.eq(settings.team_ids[0])].iloc[0]
    hou = enriched[enriched.team_id.eq(settings.team_ids[1])].iloc[0]
    assert (atl.opponent_id, atl.opponent_points, atl.point_margin, atl.venue) == (
        hou.team_id,
        104,
        -18,
        "home",
    )
    assert (hou.opponent_id, hou.opponent_points, hou.point_margin, hou.venue) == (
        atl.team_id,
        86,
        18,
        "away",
    )
    assert enriched.overtime_periods.eq(0).all()


@pytest.mark.parametrize(
    ("column", "value", "rule"),
    [
        ("field_goals_made", 999, "field_goals_made_le_attempted"),
        ("field_goal_rate", 0.999, "field_goal_rate_rounded"),
        ("three_pointers_made", 999, "threes_le_field_goals"),
        ("three_pointers_attempted", 999, "three_attempts_le_field_attempts"),
        ("points", 999, "points_identity"),
        ("rebounds", 999, "rebounds_identity"),
        ("team_minutes", 241, "team_minutes_domain"),
        ("cumulative_win_rate", 0.001, "cumulative_win_rate"),
        ("cumulative_wins", 0, "cumulative_win_rate"),
        ("won", True, "outcome_matches_score"),
        ("game_date", date(2026, 1, 30), "game_same_date"),
        ("matchup", "ATL vs. BOS", "matchup_opponent"),
        ("matchup", "ATL @ HOU", "matchup_venue"),
        ("matchup", "ATL-HOU", "matchup_format"),
        ("team_name", "Houston Rockets", "team_id_consistency"),
    ],
)
def test_bad_relations_block_enrichment(pair, column, value, rule):
    pair.loc[0, column] = value
    report, enriched = audit_quality(pair)
    assert report["status"] == "blocked"
    assert rule in report["failed_rules"]
    assert enriched is None
    assert report["coverage"] is None


def test_duplicate_rows_and_key_do_not_create_cartesian_pairs(pair):
    invalid = pd.concat([pair, pair.iloc[[0]]], ignore_index=True)
    report, enriched = audit_quality(invalid)
    assert report["status"] == "blocked"
    assert report["duplicates"] == {"row_excess": 1, "key_excess": 1}
    assert check(report, "duplicate_key")["affected_records"] == 2
    assert check(report, "pair_checks")["status"] == "not_evaluated"
    assert enriched is None


def test_absent_opponent_blocks_pairing(pair):
    report, enriched = audit_quality(pair.iloc[[0]])
    assert "game_two_rows" in report["failed_rules"]
    assert enriched is None


@pytest.mark.parametrize(
    ("column", "value", "original"),
    [
        ("points", -1, "PTS"),
        ("field_goal_rate", 1.1, "FG_PCT"),
        ("assists", pd.NA, "AST"),
        ("game_date", "not-a-date", "GAME_DATE"),
    ],
)
def test_missing_or_domain_violation_is_counted_and_blocks(pair, column, value, original):
    if column == "game_date":
        pair[column] = pair[column].astype(object)
    pair.loc[0, column] = value
    report, enriched = audit_quality(pair)
    item = profile(report, original)
    assert item["missing"] + item["outside_domain"] == 1
    if column == "points":
        assert item["negatives"] == 1
    assert check(report, "consistency_checks")["status"] == "not_evaluated"
    assert enriched is None


def test_fractional_count_is_reported_as_outside_domain(pair):
    pair["points"] = pair.points.astype("Float64")
    pair.loc[0, "points"] += 0.5
    report, enriched = audit_quality(pair)
    assert profile(report, "PTS")["outside_domain"] == 1
    assert enriched is None


def test_zero_attempts_is_undefined_ratio_not_division_by_zero(pair):
    row = pair.iloc[0]
    pair.loc[0, "points"] -= row.free_throws_made
    pair.loc[0, ["free_throws_made", "free_throws_attempted", "free_throw_rate"]] = 0
    report, enriched = audit_quality(pair)
    assert report["status"] == "passed"
    assert check(report, "free_throw_rate_undefined")["count"] == 1
    assert check(report, "free_throw_rate_rounded")["status"] == "pass"
    assert enriched.free_throws_attempted.iloc[0] == 0


def test_zeros_and_overtime_are_warnings_not_removals(pair):
    pair["blocks"] = 0
    pair["team_minutes"] = 290
    report, enriched = audit_quality(pair)
    assert report["status"] == "passed"
    assert check(report, "zero_blocks")["count"] == 2
    assert check(report, "zero_blocks")["severity"] == "warning"
    assert len(enriched) == len(pair)
    assert enriched.overtime_periods.eq(2).all()


def test_nonmonotonic_cumulative_counts_block(canonical):
    frame = canonical.copy()
    indices = frame.index[frame.team_id.eq(settings.team_ids[0])]
    idx = indices[1]
    frame.loc[idx, "cumulative_wins"] += 1
    wins, losses = frame.loc[idx, ["cumulative_wins", "cumulative_losses"]]
    frame.loc[idx, "cumulative_win_rate"] = wins / (wins + losses)
    report, enriched = audit_quality(frame)
    assert "cumulative_sequence" in report["failed_rules"]
    assert enriched is None


def test_observation_window_is_not_classified_as_mcar(pair):
    report, enriched = audit_quality(pair)
    assert enriched is not None
    assert check(report, "cumulative_unobserved_games")["count"] > 0
    missing = report["missingness"]["global"]
    assert missing["missing_cells"] == 0
    assert missing["mechanism"] == "not_identified"
    assert len(missing["methods"]) == 4
    for method in missing["methods"]:
        assert method["status"] == "not_applicable"
        assert method["executed"] is False
        assert method["p_value"] is None
        assert method["statistic"] is None
        assert method["theory"] and method["requirements"] and method["why_use"]


def test_missingness_review_does_not_pretend_tests_ran():
    report = missingness_report(pd.DataFrame({"x": [1, None, 3]}))
    assert report["missing_cells"] == 1
    assert all(m["status"] == "requires_methodological_review" for m in report["methods"])
    assert all(m["p_value"] is None and not m["executed"] for m in report["methods"])
    constant = missingness_report(pd.DataFrame({"x": [None, None]}))
    assert all(m["status"] == "not_applicable" for m in constant["methods"])


def isolated_source(tmp_path):
    config = Settings(project_root=tmp_path)
    config.raw_data_dir.mkdir(parents=True)
    with settings.dataset_path.open(newline="") as file:
        reader = csv.DictReader(file)
        columns = reader.fieldnames
        rows = [r for r in reader if r["Game_ID"] == "22500682"]
    with config.dataset_path.open("w", newline="") as file:
        writer = csv.DictWriter(file, fieldnames=columns)
        writer.writeheader()
        writer.writerows(rows)
    return replace(
        config, expected_dataset_sha256=hashlib.sha256(config.dataset_path.read_bytes()).hexdigest()
    )


@pytest.mark.parametrize(
    "invalid_kind", ["parse_error", "relation_error", "hash_error", "missing_file"]
)
def test_failed_rerun_invalidates_previous_enriched_outputs(tmp_path, invalid_kind):
    config = isolated_source(tmp_path)
    source = config.dataset_path.read_bytes()
    report = audit_data(config)
    assert report["status"] == "passed"
    assert (config.quality_dir / "canonical_enriched.parquet").is_file()
    expected = ingest(config).canonical
    generated = pd.read_parquet(config.quality_dir / "canonical_enriched.parquet")
    pd.testing.assert_frame_equal(generated.loc[:, expected.columns], expected)

    text = source.decode()
    if invalid_kind == "relation_error":
        # Confronto sintaticamente válido, mas com adversário incompatível com a outra linha.
        text = text.replace("ATL vs. HOU", "ATL vs. BOS")
    else:
        text += "invalid-record\n"
    config.dataset_path.write_text(text)
    if invalid_kind not in {"hash_error", "missing_file"}:
        config = replace(
            config,
            expected_dataset_sha256=hashlib.sha256(config.dataset_path.read_bytes()).hexdigest(),
        )
    if invalid_kind == "missing_file":
        config.dataset_path.unlink()
    report = audit_data(config)
    assert report["status"] == "blocked"
    assert not (config.quality_dir / "canonical_enriched.parquet").exists()
    assert not (config.quality_dir / "focus_enriched.parquet").exists()
    persisted = json.loads((config.quality_dir / "quality.json").read_text())
    assert persisted["status"] == "blocked"
    if invalid_kind == "missing_file":
        assert not config.dataset_path.exists()
    else:
        assert config.dataset_path.read_bytes() == text.encode()
