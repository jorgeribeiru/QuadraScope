"""Exportação deliberada do relatório compacto para revisão e versionamento no Git."""

import hashlib
import json

from backend.app.config import Settings, settings
from backend.scripts.detect_anomalies import load_parameters


def export_sensitivity_review(config: Settings = settings):
    status = json.loads((config.anomaly_dir / "status.json").read_text())
    report = json.loads((config.anomaly_dir / "sensitivity.json").read_text())
    metadata = report["metadata"]
    if (
        status["status"] != "passed"
        or metadata["source"]["sha256"] != config.expected_dataset_sha256
        or hashlib.sha256(config.dataset_path.read_bytes()).hexdigest()
        != config.expected_dataset_sha256
        or metadata["parameters"] != load_parameters(config)
    ):
        raise ValueError("Regenerar e validar detecção antes de exportar a revisão.")
    report["report_version"] = "1.0.0"
    report["review_scope"] = (
        "Todas as variantes; vetores por registro permanecem no artefato local completo."
    )
    for team in report["teams"]:
        for method in team["neighbor_methods"].values():
            for variant in method["variants"]:
                variant.pop("observations")
        for variant in team["dbscan"]:
            variant.pop("observations")
    path = config.project_root / "docs/data/anomaly-sensitivity.json"
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_text(
        json.dumps(report, ensure_ascii=False, indent=2, allow_nan=False) + "\n", encoding="utf-8"
    )
    return path


if __name__ == "__main__":
    print(export_sensitivity_review())
