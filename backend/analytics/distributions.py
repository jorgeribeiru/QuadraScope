"""Histogramas comparáveis e KDE explícita para contagens por partida."""

import math

import numpy as np
from scipy.stats import gaussian_kde

from backend.analytics.descriptive import numeric_vector


def common_bin_edges(values, max_bins: int = 256) -> dict:
    if max_bins < 1:
        raise ValueError("Número máximo de classes deve ser positivo.")
    x = numeric_vector(values)
    if len(x) and not np.equal(x, np.floor(x)).all():
        raise ValueError("Histograma alinhado a contagens requer valores inteiros.")
    if not len(x):
        return {"status": "empty", "edges": [], "method": None, "max_bins": max_bins}
    q1, q3 = np.quantile(x, [0.25, 0.75], method="linear")
    fd_width = 2 * (q3 - q1) / np.cbrt(len(x))
    if fd_width > 0:
        method, width = "freedman_diaconis", fd_width
    else:
        method = "sturges_fallback"
        width = float(np.ptp(x)) / max(1, math.ceil(math.log2(len(x)) + 1))
    width = max(1, math.ceil(width))
    start, stop = float(x.min()) - 0.5, float(x.max()) + 0.5
    capped = math.ceil((stop - start) / width) > max_bins
    if capped:
        width = max(width, math.ceil((stop - start) / max_bins))
    count = max(1, math.ceil((stop - start) / width))
    edges = start + width * np.arange(count + 1, dtype=float)
    return {
        "status": "ok",
        "edges": edges.tolist(),
        "method": method,
        "width": width,
        "fd_width": float(fd_width),
        "integer_alignment": "half_integer_edges",
        "max_bins": max_bins,
        "resolution_capped": capped,
    }


def compare_distributions(groups: dict[str, np.ndarray], unit: str) -> dict:
    if not groups:
        raise ValueError("Informar ao menos um time.")
    arrays = {team: numeric_vector(values) for team, values in groups.items()}
    pooled = np.concatenate(list(arrays.values()))
    bins = common_bin_edges(pooled)
    kernels, unavailable = {}, {}
    for team, x in arrays.items():
        if len(x) < 2:
            unavailable[team] = ("empty" if not len(x) else "insufficient_sample", "KDE exige n≥2.")
        elif np.unique(x).size == 1:
            unavailable[team] = ("constant_series", "KDE não definida para covariância zero.")
        else:
            try:
                kernels[team] = gaussian_kde(x, bw_method="scott")
            except (ValueError, np.linalg.LinAlgError):
                unavailable[team] = ("not_applicable", "Covariância numericamente singular.")
    grid = np.array([], dtype=float)
    if kernels:
        bandwidth = max(float(np.sqrt(kernel.covariance[0, 0])) for kernel in kernels.values())
        grid = np.linspace(
            float(pooled.min()) - 3 * bandwidth, float(pooled.max()) + 3 * bandwidth, 256
        )
    teams = []
    for team, x in arrays.items():
        counts = np.histogram(x, bins=bins["edges"])[0] if bins["edges"] else np.array([])
        density = (counts / (len(x) * np.diff(bins["edges"]))).tolist() if len(x) else []
        histogram = {
            "status": "ok" if len(x) else "empty",
            "n": len(x),
            "counts": counts.astype(int).tolist(),
            "density": density,
            "edges": bins["edges"],
            "unit": f"1/({unit})",
            "interval_policy": "[left,right), último inclui right",
        }
        if team in kernels:
            kernel = kernels[team]
            kde = {
                "status": "ok",
                "reason": None,
                "x": grid.tolist(),
                "density": kernel(grid).tolist(),
                "bandwidth_factor": float(kernel.factor),
                "bandwidth": float(np.sqrt(kernel.covariance[0, 0])),
                "probability_in_grid": float(kernel.integrate_box_1d(grid[0], grid[-1])),
            }
        else:
            status, reason = unavailable[team]
            kde = {
                "status": status,
                "reason": reason,
                "x": [],
                "density": [],
                "bandwidth_factor": None,
                "bandwidth": None,
                "probability_in_grid": None,
            }
        kde.update(
            {
                "n": len(x),
                "method": "scipy.stats.gaussian_kde",
                "bw_method": "scott",
                "unit": f"1/({unit})",
                "warnings": [
                    "Suavização de contagens discretas; pode atribuir densidade fora do domínio.",
                    "Grade finita sem renormalização; não representa toda a massa da distribuição.",
                ],
            }
        )
        teams.append({"team_id": team, "n": len(x), "histogram": histogram, "kde": kde})
    return {
        "unit": unit,
        "reference_team_ids": list(groups),
        "pooled_n": len(pooled),
        "bin_parameters": bins,
        "grid_parameters": {"points": 256, "bandwidth_padding": 3},
        "teams": teams,
    }
