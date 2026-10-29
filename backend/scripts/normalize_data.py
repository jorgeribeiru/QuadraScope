"""Gera somente intermediários da etapa 2; não publica análises validadas."""

import json
import sys
from pathlib import Path
from tempfile import TemporaryDirectory

from backend.analytics.ingestion import DatasetValidationError, ingest
from backend.app.config import Settings, settings


def normalize_data(config: Settings = settings) -> dict:
    output = config.ingestion_dir.resolve()
    raw = config.raw_data_dir.resolve()
    if output.is_relative_to(raw) or raw.is_relative_to(output):
        raise DatasetValidationError("Diretório de saída não pode sobrepor os dados brutos.")

    result = ingest(config)
    report = result.report(config)
    output.mkdir(parents=True, exist_ok=True)
    # Preparar ambos os Parquets antes de substituir saídas; relatório escrito por último.
    # Publicação transacional de artefatos finais pertence à etapa 6.
    with TemporaryDirectory(prefix=".normalization-", dir=output.parent) as directory:
        staging = Path(directory)
        result.canonical.to_parquet(staging / "canonical.parquet", engine="pyarrow", index=False)
        result.focus.to_parquet(staging / "focus.parquet", engine="pyarrow", index=False)
        (staging / "ingestion.json").write_text(
            json.dumps(report, indent=2, ensure_ascii=False, allow_nan=False) + "\n",
            encoding="utf-8",
        )
        for filename in ("canonical.parquet", "focus.parquet", "ingestion.json"):
            (staging / filename).replace(output / filename)
    return report


def main() -> int:
    try:
        report = normalize_data()
    except (DatasetValidationError, OSError) as error:
        print(f"Normalização interrompida: {error}", file=sys.stderr)
        return 1
    print(
        f"Base canônica: {report['canonical']['rows']} linhas, "
        f"{report['canonical']['columns']} colunas, {report['canonical']['teams']} times."
    )
    print(f"Recorte do grupo: {report['focus']['rows']} linhas.")
    print(f"SHA-256: {report['source']['sha256']}")
    print(f"Saída: {settings.ingestion_dir}")
    print("Intermediários gerados; validação completa de qualidade pendente da etapa 3.")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
