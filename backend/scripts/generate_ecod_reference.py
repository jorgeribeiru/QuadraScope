"""Ferramenta opcional: executar somente no ambiente temporário PyOD documentado."""

import json
import warnings
from importlib.metadata import distribution, version

import numpy as np

from backend.analytics.ecod import REFERENCE_COMMIT
from backend.app.config import settings

CASES = {
    "symmetric": [[-3], [-2], [-1], [0], [1], [2], [3]],
    "right_skew": [[0, 1], [0, 1], [1, 2], [1, 2], [1, 3], [2, 3], [2, 4], [20, 30]],
    "left_skew": [[0, -1], [0, -1], [-1, -2], [-1, -2], [-1, -3], [-2, -3], [-2, -4], [-20, -30]],
    "ties_and_constant": [[0, 4, 8], [0, 4, 8], [1, 3, 8], [1, 2, 8], [2, 1, 8], [10, 0, 8]],
    "constant": [[2, 3], [2, 3], [2, 3], [2, 3]],
    "near_constant": [[1e16], [1e16 + 2], [1e16 + 4]],
}


def main() -> int:
    # Importação deliberadamente local: PyOD não é dependência de runtime/dev do projeto.
    from pyod.models.ecod import ECOD

    direct = json.loads(distribution("pyod").read_text("direct_url.json") or "{}")
    if direct.get("vcs_info", {}).get("commit_id") != REFERENCE_COMMIT:
        raise ValueError("Instalar a revisão VCS fixada do PyOD antes de gerar fixtures.")
    fixture = {
        "reference": {
            "repository": "https://github.com/yzhao062/pyod",
            "commit": REFERENCE_COMMIT,
            "license": "BSD-2-Clause",
            "mode": "fit on reference population, n_jobs=1",
            "versions": {
                name: version(name) for name in ("pyod", "numpy", "scipy", "scikit-learn")
            },
        },
        "tolerance": {"rtol": 1e-12, "atol": 1e-12},
        "cases": [],
    }
    for name, data in CASES.items():
        x = np.array(data, dtype=float)
        with warnings.catch_warnings():
            warnings.simplefilter("ignore", RuntimeWarning)  # Referência usa skew em constantes.
            detector = ECOD(n_jobs=1, contamination=0.1).fit(x)
        fixture["cases"].append(
            {
                "name": name,
                "input": data,
                "scores": detector.decision_scores_.tolist(),
                "contributions": detector.O.tolist(),
                "left_probability": np.exp(-detector.U_l).tolist(),
                "right_probability": np.exp(-detector.U_r).tolist(),
            }
        )
    path = settings.project_root / "backend/tests/fixtures/ecod-reference.json"
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_text(json.dumps(fixture, indent=2, allow_nan=False) + "\n", encoding="utf-8")
    print(f"Fixtures de referência geradas: {path}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
