"""Gera scores e sensibilidade offline, após validar entrada e configuração revisada."""

import json
import math
import sys
from dataclasses import asdict
from importlib.metadata import version
from pathlib import Path
from tempfile import TemporaryDirectory

from backend.analytics.anomaly_reports import anomaly_reports
from backend.analytics.ingestion import DatasetValidationError, ingest, select_focus
from backend.analytics.quality import audit_quality
from backend.analytics.sensitivity import sensitivity_report
from backend.app.config import Settings, settings


def load_parameters(config: Settings = settings) -> dict:
    path = Path(__file__).resolve().parents[1] / "content" / "anomaly-parameters.json"
    parameters = json.loads(path.read_text(encoding="utf-8"))
    if parameters["dataset_sha256"] != config.expected_dataset_sha256:
        raise ValueError("Configuração dos detectores não foi revisada para este snapshot.")
    if parameters["validation_status"] != "reviewed_for_snapshot":
        raise ValueError("Parâmetros precisam de revisão antes de publicar scores.")
    if parameters["features"] != list(config.metrics):
        raise ValueError("Ordem de features diverge da configuração revisada.")
    return parameters


def detect_anomalies(config: Settings = settings) -> dict:
    output, raw = config.anomaly_dir.resolve(), config.raw_data_dir.resolve()
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
        parameters = load_parameters(config)
        focus = select_focus(enriched, config)
        sensitivity = sensitivity_report(focus, config)
        selection = sensitivity["selection"]
        if (
            parameters["dbscan_eps"] != selection["dbscan_eps"]
            or parameters["neighbor_k"] != selection["neighbor_k"]
            or parameters["scaler"] != selection["scaler"]
            or parameters["dbscan_min_samples"] != selection["min_samples"]
            or not math.isclose(
                parameters["selection"]["median_knee"],
                selection["median_standard_4distance_knee"],
                rel_tol=1e-12,
                abs_tol=1e-12,
            )
        ):
            raise ValueError(
                "Sensibilidade diverge da seleção revisada; revisar parâmetros antes de publicar."
            )
        metadata = {
            "source": asdict(result.source),
            "schema_version": config.schema_version,
            "analysis_version": config.analysis_version,
            "parameter_version": parameters["version"],
            "parameters": parameters,
            "scope": "full_team_history_in_dataset",
            "display_filters": {"from": None, "to": None, "venue": "all", "outcome": "all"},
            "dependencies": {name: version(name) for name in ("numpy", "scipy", "scikit-learn")},
        }
        anomalies = anomaly_reports(focus, parameters, config)
        reports = {
            "anomalies": {"metadata": metadata, **anomalies},
            "sensitivity": {"metadata": metadata, **sensitivity},
        }
        status = {
            "status": "passed",
            "reason": None,
            "metadata": metadata,
            "result_count": len(anomalies["results"]),
            "limitations": "Sem rótulos de verdade; ruído e cortes relativos são exploratórios.",
        }
    except (ValueError, OSError) as error:
        status = {"status": "blocked", "reason": str(error)}
    output.mkdir(parents=True, exist_ok=True)
    with TemporaryDirectory(prefix=".anomalies-", dir=output.parent) as directory:
        staging = Path(directory)
        for name in ("anomalies", "sensitivity"):
            if reports is not None:
                (staging / f"{name}.json").write_text(
                    json.dumps(reports[name], ensure_ascii=False, indent=2, allow_nan=False) + "\n",
                    encoding="utf-8",
                )
        (staging / "status.json").write_text(
            json.dumps(status, ensure_ascii=False, indent=2, allow_nan=False) + "\n",
            encoding="utf-8",
        )
        for name in ("anomalies", "sensitivity"):
            if reports is None:
                (output / f"{name}.json").unlink(missing_ok=True)
            else:
                (staging / f"{name}.json").replace(output / f"{name}.json")
        (staging / "status.json").replace(output / "status.json")
    return status


def main() -> int:
    try:
        status = detect_anomalies()
    except (ValueError, OSError) as error:
        print(f"Detecção interrompida: {error}", file=sys.stderr)
        return 1
    if status["status"] != "passed":
        print(f"Detecção bloqueada: {status['reason']}", file=sys.stderr)
        return 1
    print(f"Detectores validados: {status['result_count']} resultados e análise de sensibilidade.")
    print(f"Saída: {settings.anomaly_dir}")
    print("População fixa por time; não interpretar escores como probabilidade de erro.")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
