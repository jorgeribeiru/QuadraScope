"""Produz descritivas somente a partir do snapshot de entrada aprovado na auditoria."""

import json
import sys
from dataclasses import asdict
from pathlib import Path
from tempfile import TemporaryDirectory

from backend.analytics.comparisons import descriptive_reports
from backend.analytics.ingestion import DatasetValidationError, ingest, select_focus
from backend.analytics.quality import audit_quality
from backend.app.config import Settings, settings


def describe_data(config: Settings = settings) -> dict:
    output, raw = config.descriptive_dir.resolve(), config.raw_data_dir.resolve()
    if output.is_relative_to(raw) or raw.is_relative_to(output):
        raise DatasetValidationError("Diretório de saída não pode sobrepor os dados brutos.")
    reports = None
    try:
        result = ingest(config)
        quality, enriched = audit_quality(result.canonical, config)
        if quality["status"] != "passed":
            raise DatasetValidationError(
                "Qualidade bloqueada: " + ", ".join(quality["failed_rules"])
            )
        reports = descriptive_reports(select_focus(enriched, config), config)
        metadata = {
            "source": asdict(result.source),
            "schema_version": config.schema_version,
            "analysis_version": config.analysis_version,
            "team_ids": list(config.team_ids),
            "metric_codes": list(config.metrics),
            "scope": "full_team_history_in_dataset",
            "filters": {"from": None, "to": None, "venue": "all", "outcome": "all"},
            "parameters": {
                "ddof": 1,
                "quantile_method": "linear",
                "iqr_k": 1.5,
                "skewness_bias": False,
                "kde_bandwidth": "scott",
                "histogram_max_bins": 256,
            },
        }
        status = {
            "status": "passed",
            "reason": None,
            **metadata,
            "limitations": "Descritivas prontas; detectores e manifesto final ainda pendentes.",
        }
    except (ValueError, OSError) as error:
        status = {"status": "blocked", "reason": str(error)}
    output.mkdir(parents=True, exist_ok=True)
    names = ("descriptives", "distributions", "comparisons")
    with TemporaryDirectory(prefix=".descriptive-", dir=output.parent) as directory:
        staging = Path(directory)
        if reports is not None:
            for name in names:
                (staging / f"{name}.json").write_text(
                    json.dumps(
                        {"metadata": metadata, **reports[name]},
                        ensure_ascii=False,
                        indent=2,
                        allow_nan=False,
                    )
                    + "\n",
                    encoding="utf-8",
                )
        (staging / "status.json").write_text(
            json.dumps(status, ensure_ascii=False, indent=2, allow_nan=False) + "\n",
            encoding="utf-8",
        )
        for name in names:
            if reports is None:
                (output / f"{name}.json").unlink(missing_ok=True)
            else:
                (staging / f"{name}.json").replace(output / f"{name}.json")
        (staging / "status.json").replace(output / "status.json")
    return status


def main() -> int:
    try:
        status = describe_data()
    except (ValueError, OSError) as error:
        print(f"Descritivas interrompidas: {error}", file=sys.stderr)
        return 1
    if status["status"] != "passed":
        print(f"Descritivas bloqueadas: {status['reason']}", file=sys.stderr)
        return 1
    print("Descritivas geradas: 7 variáveis × 2 times; quadros CV/IQR, boxplots e distribuições.")
    print(f"Saída: {settings.descriptive_dir}")
    print("API, interface e detecção completa de outliers continuam nas próximas etapas.")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
