"""Valores manuais, propriedades e referências reais das descritivas."""

import json
import math
from datetime import date, timedelta

import pandas as pd
import pytest

from backend.analytics.comparisons import descriptive_reports
from backend.analytics.descriptive import (
    classify_skewness,
    describe_team,
    describe_values,
    iqr_limits,
)
from backend.analytics.ingestion import ingest
from backend.app.config import settings

pytestmark = pytest.mark.analytics


def observation_frame(values, team_id=None):
    n = len(values)
    return pd.DataFrame(
        {
            "team_id": [team_id or settings.team_ids[0]] * n,
            "game_id": [f"game-{i}" for i in range(n)],
            "game_date": [date(2026, 1, 1) + timedelta(days=i) for i in range(n)],
            "matchup": ["ATL vs. BOS"] * n,
            "points": values,
        }
    )


def test_manual_sample_measures_and_units():
    result = describe_values([1, 2, 2, 3, 4], "pontos/jogo")
    stats = result["statistics"]
    expected = {
        "mean": 2.4,
        "median": 2,
        "minimum": 1,
        "maximum": 4,
        "range": 3,
        "variance": 1.3,
        "std": math.sqrt(1.3),
        "q1": 2,
        "q3": 3,
        "iqr": 1,
        "cv": 100 * math.sqrt(1.3) / 2.4,
        "iqr_median_ratio": 0.5,
    }
    for name, value in expected.items():
        assert stats[name]["value"] == pytest.approx(value)
        assert stats[name]["status"] == "ok"
    assert stats["modes"]["value"] == [2]
    assert stats["modes"]["frequency"] == 2
    assert stats["variance"]["unit"] == "(pontos/jogo)²"
    assert stats["cv"]["unit"] == "%"
    assert stats["iqr_median_ratio"]["unit"] == "fração"
    assert stats["std"]["parameters"]["ddof"] == 1


@pytest.mark.parametrize(
    "values,modes,frequency",
    [
        ([1, 1, 2, 2, 3], [1, 2], 2),
        ([4, 4, 4], [4], 3),
        ([1, 2, 3], [], 1),
        ([1], [], 1),
    ],
)
def test_modes_do_not_discard_ties_or_invent_a_single_mode(values, modes, frequency):
    stat = describe_values(values)["statistics"]["modes"]
    assert stat["value"] == modes
    assert stat["frequency"] == frequency
    assert stat["status"] == ("ok" if modes else "not_applicable")


@pytest.mark.parametrize("n", [0, 1, 2])
def test_small_samples_report_each_measure_separately(n):
    result = describe_values(list(range(1, n + 1)))
    stats = result["statistics"]
    assert result["n"] == n
    if not n:
        assert all(stat["status"] == "empty" for stat in stats.values())
        assert stats["modes"]["value"] == []
    else:
        assert stats["mean"]["status"] == "ok"
        assert stats["skewness"]["status"] == "insufficient_sample"
        assert stats["variance"]["status"] == ("ok" if n == 2 else "insufficient_sample")
        assert stats["cv"]["status"] == ("ok" if n == 2 else "insufficient_sample")
    json.dumps(result, allow_nan=False)


@pytest.mark.parametrize("value", [0, 7])
def test_constant_series_keeps_zero_dispersion_but_skewness_undefined(value):
    result = describe_values([value] * 4)
    stats = result["statistics"]
    assert stats["variance"]["value"] == 0
    assert stats["std"]["value"] == 0
    assert stats["iqr"]["value"] == 0
    assert stats["skewness"]["value"] is None
    assert stats["skewness"]["status"] == "constant_series"
    if value:
        assert stats["cv"]["value"] == 0
    else:
        assert stats["cv"]["status"] == "not_applicable"
        assert stats["iqr_median_ratio"]["value"] is None
    json.dumps(result, allow_nan=False)


def test_cv_requires_positive_mean_and_ratio_scale():
    assert describe_values([-1, 0, 1])["statistics"]["cv"]["value"] is None
    assert describe_values([-3, -2, -1])["statistics"]["cv"]["value"] is None
    result = describe_values([1, 2, 3], ratio_scale=False)
    assert result["statistics"]["cv"]["status"] == "not_applicable"
    assert result["statistics"]["iqr_median_ratio"]["status"] == "not_applicable"


@pytest.mark.parametrize(
    "values", [[1, float("nan")], [1, float("inf")], [1, None], [[1, 2]], ["bad"]]
)
def test_invalid_observations_are_not_silently_dropped(values):
    with pytest.raises(ValueError):
        describe_values(values)


def test_adjusted_skewness_matches_a_manual_three_point_result():
    result = describe_values([0, 0, 1])
    assert result["statistics"]["skewness"]["value"] == pytest.approx(math.sqrt(3))
    assert result["skewness_classification"]["direction"] == "right"
    assert result["skewness_classification"]["intensity"] == "strong"
    mirror = describe_values([0, 1, 1])
    assert mirror["statistics"]["skewness"]["value"] == pytest.approx(-math.sqrt(3))
    assert mirror["skewness_classification"]["direction"] == "left"


@pytest.mark.parametrize(
    "coefficient,intensity",
    [
        (0, "approximately_symmetric"),
        (0.49999, "approximately_symmetric"),
        (0.5, "moderate"),
        (-0.99999, "moderate"),
        (-1, "strong"),
    ],
)
def test_classification_boundaries_are_explicit(coefficient, intensity):
    result = classify_skewness(coefficient)
    assert result["intensity"] == intensity
    if coefficient == 0:
        assert result["direction"] == "neutral"


def test_scale_changes_variance_and_iqr_but_not_cv_or_skewness():
    a = describe_values([1, 2, 2, 3, 4])["statistics"]
    b = describe_values([10, 20, 20, 30, 40])["statistics"]
    assert b["variance"]["value"] == pytest.approx(100 * a["variance"]["value"])
    assert b["iqr"]["value"] == pytest.approx(10 * a["iqr"]["value"])
    assert b["cv"]["value"] == pytest.approx(a["cv"]["value"])
    assert b["skewness"]["value"] == pytest.approx(a["skewness"]["value"])


def test_values_equal_to_fences_are_inside_and_whiskers_are_observations():
    frame = observation_frame([0, 3, 4, 5, 8])
    result = describe_team(frame, settings.team_ids[0], "PTS")
    box = result["boxplot"]
    assert (box["lower_fence"], box["upper_fence"]) == (0, 8)
    assert box["outlier_count"] == 0
    result = describe_team(observation_frame([0, 1, 2, 3, 10]), settings.team_ids[0], "PTS")
    box = result["boxplot"]
    assert (box["lower_fence"], box["upper_fence"]) == (-2, 6)
    assert (box["lower_whisker"], box["upper_whisker"]) == (0, 3)
    assert box["outliers"] == [
        {
            "team_id": settings.team_ids[0],
            "game_id": "game-4",
            "game_date": "2026-01-05",
            "matchup": "ATL vs. BOS",
            "value": 10.0,
            "side": "upper",
        }
    ]


def test_iqr_zero_keeps_rule_and_identifies_extreme():
    result = describe_team(observation_frame([1, 1, 1, 1, 1, 5]), settings.team_ids[0], "PTS")
    box = result["boxplot"]
    assert box["iqr"] == 0
    assert box["lower_whisker"] == box["upper_whisker"] == 1
    assert box["outlier_count"] == 1
    assert box["outliers"][0]["value"] == 5
    assert any("IQR zero" in warning for warning in result["warnings"])


def test_empty_team_retains_states_and_no_fabricated_boxplot_values():
    result = describe_team(observation_frame([]), settings.team_ids[0], "PTS")
    assert result["n"] == 0 and result["period"] is None
    assert result["boxplot"]["status"] == "empty"
    assert result["boxplot"]["lower_whisker"] is None
    json.dumps(result, allow_nan=False)


@pytest.mark.parametrize("k", [0, -1, float("nan"), float("inf")])
def test_invalid_iqr_multiplier_is_rejected(k):
    with pytest.raises(ValueError):
        iqr_limits([1, 2, 3], k)


def test_real_references_and_comparison_tables_share_values():
    result = ingest()
    reports = descriptive_reports(result.focus)
    items = reports["descriptives"]["results"]
    lookup = {(item["metric"], item["team_id"]): item for item in items}
    atl = lookup["PTS", settings.team_ids[0]]
    hou = lookup["PTS", settings.team_ids[1]]
    assert len(items) == 14
    assert atl["n"] == 75 and hou["n"] == 74
    assert atl["statistics"]["mean"]["value"] == pytest.approx(118.25333333333333)
    assert hou["statistics"]["mean"]["value"] == pytest.approx(114.4054054054054)
    assert atl["statistics"]["cv"]["value"] == pytest.approx(10.6551, abs=0.0001)
    assert hou["statistics"]["cv"]["value"] == pytest.approx(9.7837, abs=0.0001)
    assert (atl["boxplot"]["q1"], atl["boxplot"]["q3"], atl["boxplot"]["iqr"]) == (110.5, 126, 15.5)
    assert (atl["boxplot"]["lower_fence"], atl["boxplot"]["upper_fence"]) == (87.25, 149.25)
    assert {(r["game_id"], r["value"]) for r in atl["boxplot"]["outliers"]} == {
        ("22500396", 150),
        ("22500682", 86),
    }
    assert hou["statistics"]["modes"]["value"] == [111, 117, 119, 124]
    assert lookup["STL", settings.team_ids[0]]["statistics"]["modes"]["value"] == [9, 11]
    for name, matrix in reports["comparisons"]["matrices"].items():
        assert len(matrix["rows"]) == 7
        assert matrix["team_ids"] == list(settings.team_ids)
        for row in matrix["rows"]:
            for team, cell in row["teams"].items():
                assert cell["value"] == lookup[row["metric"], team]["statistics"][name]["value"]
                assert cell["n"] == lookup[row["metric"], team]["n"]
    assert len(reports["comparisons"]["quartiles"]) == 14
    for item in items:
        for key in ("mean", "median", "q1", "q3", "iqr"):
            assert item["boxplot"][key] == item["statistics"][key]["value"]
    json.dumps(reports, allow_nan=False)


def test_empty_selection_keeps_both_teams_and_all_matrix_cells():
    focus = ingest().focus.iloc[:0]
    reports = descriptive_reports(focus)
    assert len(reports["descriptives"]["results"]) == 14
    for item in reports["descriptives"]["results"]:
        assert item["n"] == 0
        assert item["statistics"]["mean"]["status"] == "empty"
    for matrix in reports["comparisons"]["matrices"].values():
        assert len(matrix["rows"]) == 7
        for row in matrix["rows"]:
            assert set(row["teams"]) == set(settings.team_ids)
            assert all(cell["n"] == 0 and cell["value"] is None for cell in row["teams"].values())
    json.dumps(reports, allow_nan=False)
