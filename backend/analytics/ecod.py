"""ECOD para a própria população de ajuste, com caudas inclusivas e empates.

Implementação independente validada contra PyOD, revisão fixada em REFERENCE_COMMIT.
Autores da referência: Zheng Li e Yue Zhao; licença BSD-2-Clause.
Ver docs/references/pyod-ecod-LICENSE.txt e fixtures de validação.
"""

import warnings

import numpy as np
from scipy.stats import skew

REFERENCE_COMMIT = "7e1330e10ac5c56ed402fbbaa41b225efb4bbc5c"


def numeric_matrix(values) -> np.ndarray:
    matrix = np.asarray(values, dtype=float)
    if matrix.ndim != 2 or not matrix.shape[0] or not matrix.shape[1]:
        raise ValueError("Esperada matriz não vazia com observações × variáveis.")
    if not np.isfinite(matrix).all():
        raise ValueError("Matriz deve conter somente valores finitos, sem ausências.")
    return matrix


def ecod_scores(values) -> dict:
    matrix = numeric_matrix(values)
    n, dimensions = matrix.shape
    left = np.empty_like(matrix)
    right = np.empty_like(matrix)
    signs = np.zeros(dimensions)
    fallback_columns = []
    for column in range(dimensions):
        x = matrix[:, column]
        ordered = np.sort(x)
        # Empates recebem a probabilidade inclusiva inteira, não um rank arbitrário.
        left[:, column] = np.searchsorted(ordered, x, side="right") / n
        right[:, column] = (n - np.searchsorted(ordered, x, side="left")) / n
        if np.ptp(x) > 0:
            with warnings.catch_warnings():
                warnings.filterwarnings(
                    "ignore", message="Precision loss occurred.*", category=RuntimeWarning
                )
                coefficient = skew(x, bias=True, nan_policy="raise")
            if not np.isfinite(coefficient):
                fallback_columns.append(column)
            signs[column] = np.sign(np.nan_to_num(coefficient))
        else:
            fallback_columns.append(column)
    lower, upper = -np.log(left), -np.log(right)
    # Peso da cauda segundo o sinal: em assimetria exatamente zero, somar ambas.
    skew_tail = np.where(signs <= 0, lower, 0) + np.where(signs >= 0, upper, 0)
    contributions = np.maximum(np.maximum(lower, upper), skew_tail)
    return {
        "scores": contributions.sum(axis=1),
        "contributions": contributions,
        "left_probability": left,
        "right_probability": right,
        "skewness_signs": signs,
        "skewness_fallback_columns": fallback_columns,
    }
