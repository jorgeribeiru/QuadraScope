"""Densidade, bins compartilhados e limites da KDE em contagens discretas."""

import json

import numpy as np
import pytest

from backend.analytics.distributions import common_bin_edges, compare_distributions

pytestmark = pytest.mark.analytics


def test_common_integer_bins_cover_both_teams_and_histograms_integrate_to_one():
    result = compare_distributions({"a": np.arange(6), "b": np.arange(6, 12)}, "pontos/jogo")
    assert result["bin_parameters"]["method"] == "freedman_diaconis"
    a, b = result["teams"]
    assert a["histogram"]["edges"] == b["histogram"]["edges"]
    edges = np.array(a["histogram"]["edges"])
    assert edges[0] <= 0 and edges[-1] >= 11
    assert (np.diff(edges) >= 1).all()
    assert np.equal(edges - 0.5, np.floor(edges - 0.5)).all()
    for team in (a, b):
        h = team["histogram"]
        assert sum(h["counts"]) == 6
        assert np.sum(np.array(h["density"]) * np.diff(edges)) == pytest.approx(1)
        kde = team["kde"]
        assert kde["status"] == "ok" and kde["bw_method"] == "scott"
        assert len(kde["x"]) == len(kde["density"]) == 256
        assert min(kde["density"]) >= 0
        assert 0 < kde["probability_in_grid"] <= 1
        assert kde["unit"] == h["unit"] == "1/(pontos/jogo)"
    assert a["kde"]["x"] == b["kde"]["x"]


def test_degenerate_iqr_uses_sturges_and_constant_kde_is_not_invented():
    result = compare_distributions({"a": [2, 2, 2], "b": [2]}, "tocos/jogo")
    assert result["bin_parameters"]["method"] == "sturges_fallback"
    assert result["bin_parameters"]["edges"] == [1.5, 2.5]
    a, b = result["teams"]
    assert a["histogram"]["density"] == [1]
    assert a["kde"]["status"] == "constant_series"
    assert b["kde"]["status"] == "insufficient_sample"
    assert a["kde"]["density"] == []


@pytest.mark.parametrize("groups", [{"a": [], "b": []}, {"a": [], "b": [0, 1, 2]}])
def test_empty_group_has_no_undefined_density_or_kde(groups):
    result = compare_distributions(groups, "pontos/jogo")
    assert result["teams"][0]["histogram"]["status"] == "empty"
    assert result["teams"][0]["kde"]["status"] == "empty"
    assert result["teams"][0]["histogram"]["density"] == []
    json.dumps(result, allow_nan=False)


def test_small_fd_width_with_large_extreme_caps_resolution_without_losing_values():
    values = [*range(100), 10**9]
    edges = common_bin_edges(values)
    assert edges["resolution_capped"] is True
    assert len(edges["edges"]) - 1 <= 256
    counts = np.histogram(values, bins=edges["edges"])[0]
    assert int(counts.sum()) == len(values)


def test_invalid_histogram_observations_are_rejected():
    with pytest.raises(ValueError):
        common_bin_edges([0.1, 0.2])
    with pytest.raises(ValueError):
        common_bin_edges([1, 2], max_bins=0)
    with pytest.raises(ValueError):
        compare_distributions({}, "unidades")


def test_kde_and_histograms_do_not_change_when_order_of_games_changes():
    a = compare_distributions({"a": [0, 1, 1, 3, 5], "b": [1, 2, 3]}, "unidades")
    b = compare_distributions({"a": [5, 3, 1, 1, 0], "b": [3, 2, 1]}, "unidades")
    for left, right in zip(a["teams"], b["teams"], strict=True):
        assert left["histogram"] == right["histogram"]
        assert left["kde"]["density"] == pytest.approx(right["kde"]["density"])
