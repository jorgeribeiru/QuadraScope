"""Oráculo externo fixado; testes normais são offline e não importam PyOD."""

import json
from pathlib import Path

import numpy as np
import pytest

from backend.analytics.ecod import REFERENCE_COMMIT, ecod_scores

pytestmark = pytest.mark.analytics
FIXTURE = json.loads((Path(__file__).parents[1] / "fixtures/ecod-reference.json").read_text())


@pytest.mark.parametrize("case", FIXTURE["cases"], ids=lambda case: case["name"])
def test_scores_probabilities_and_contributions_match_pinned_oracle(case):
    assert FIXTURE["reference"]["commit"] == REFERENCE_COMMIT
    actual = ecod_scores(case["input"])
    for name in ("scores", "contributions", "left_probability", "right_probability"):
        np.testing.assert_allclose(actual[name], case[name], **FIXTURE["tolerance"])
    np.testing.assert_allclose(actual["contributions"].sum(axis=1), actual["scores"])


def test_tied_upper_tail_is_not_one_minus_the_left_cdf():
    result = ecod_scores([[0], [0], [2]])
    assert result["left_probability"][:, 0] == pytest.approx([2 / 3, 2 / 3, 1])
    assert result["right_probability"][:, 0] == pytest.approx([1, 1, 1 / 3])
    assert (result["left_probability"] > 0).all()
    assert (result["right_probability"] > 0).all()


@pytest.mark.parametrize("case", FIXTURE["cases"], ids=lambda case: case["name"])
def test_permutation_of_reference_rows_preserves_scores(case):
    x = np.array(case["input"], dtype=float)
    permutation = np.random.default_rng(42).permutation(len(x))
    expected = np.array(case["scores"])[permutation]
    np.testing.assert_allclose(
        ecod_scores(x[permutation])["scores"], expected, **FIXTURE["tolerance"]
    )


@pytest.mark.parametrize("matrix", [[], [[float("nan")]], [[1, float("inf")]], [1, 2, 3]])
def test_invalid_reference_matrix_is_rejected(matrix):
    with pytest.raises(ValueError):
        ecod_scores(matrix)
