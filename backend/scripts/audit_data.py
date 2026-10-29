"""Gera relatório de qualidade e só libera intermediários enriquecidos se aprovados."""

import json
import sys
from dataclasses import asdict
from pathlib import Path
from tempfile import TemporaryDirectory

from backend.analytics.ingestion import DatasetValidationError, ingest, select_focus
from backend.analytics.quality import audit_quality
from backend.app.config import Settings, settings


def audit_data(config: Settings = settings) -> dict:
    output, raw = config.quality_dir.resolve(), config.raw_data_dir.resolve()
    if output.is_relative_to(raw) or raw.is_relative_to(output):
        raise DatasetValidationError("Diretório de saída não pode sobrepor os dados brutos.")
    try:
        result = ingest(config)
        report, enriched = audit_quality(result.canonical, config)
        report["source"] = asdict(result.source)
    except (DatasetValidationError, OSError) as error:
        enriched = None
        report = {
            "status": "blocked",
            "failed_rules": ["ingestion"],
            "checks": [
                {
                    "rule": "ingestion",
                    "severity": "blocker",
                    "status": "fail",
                    "description": str(error),
                }
            ],
            "coverage": None,
            "source": None,
        }
    report["schema_version"] = config.schema_version
    report["analysis_version"] = config.analysis_version
    output.mkdir(parents=True, exist_ok=True)
    names = ("canonical_enriched.parquet", "focus_enriched.parquet")
    with TemporaryDirectory(prefix=".quality-", dir=output.parent) as directory:
        staging = Path(directory)
        if enriched is not None:
            enriched.to_parquet(staging / names[0], engine="pyarrow", index=False)
            select_focus(enriched, config).to_parquet(
                staging / names[1], engine="pyarrow", index=False
            )
        (staging / "quality.json").write_text(
            json.dumps(report, indent=2, ensure_ascii=False, allow_nan=False) + "\n",
            encoding="utf-8",
        )
        for name in names:
            if enriched is None:
                # Invalidar também intermediários antigos de uma execução anteriormente aprovada.
                (output / name).unlink(missing_ok=True)
            else:
                (staging / name).replace(output / name)
        (staging / "quality.json").replace(output / "quality.json")
    return report


def main() -> int:
    try:
        report = audit_data()
    except (DatasetValidationError, OSError) as error:
        print(f"Auditoria interrompida: {error}", file=sys.stderr)
        return 1
    if report["status"] != "passed":
        print(f"Qualidade bloqueada: {', '.join(report['failed_rules'])}.", file=sys.stderr)
        print(f"Diagnóstico: {settings.quality_dir / 'quality.json'}", file=sys.stderr)
        return 1
    c = report["coverage"]
    print(
        f"Qualidade aprovada: {c['rows']} registros, {c['teams']} times, "
        f"{c['unique_games']} partidas."
    )
    print(
        f"Grupo: {c['focus']['rows']} registros, {c['focus']['unique_games']} partidas distintas."
    )
    print(f"Relatório e intermediários enriquecidos: {settings.quality_dir}")
    print("Resultados estatísticos e publicação final continuam nas próximas etapas.")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
