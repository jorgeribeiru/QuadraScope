"""Verifica a instalação sem executar ingestão, análise ou serviço HTTP."""

import json
import sys
from importlib import import_module
from importlib.metadata import version

from backend.app.config import settings

DEPENDENCIES = {
    "fastapi": "fastapi",
    "numpy": "numpy",
    "pandas": "pandas",
    "pyarrow": "pyarrow",
    "pydantic": "pydantic",
    "scikit-learn": "sklearn",
    "scipy": "scipy",
    "uvicorn": "uvicorn",
}


def main() -> int:
    if sys.version_info[:2] != (3, 12):
        print("Python 3.12 é necessário; execute make setup.", file=sys.stderr)
        return 1

    try:
        versions = {}
        for distribution, module in DEPENDENCIES.items():
            import_module(module)
            versions[distribution] = version(distribution)
    except ImportError as error:
        print(f"Dependência indisponível: {error}. Execute make setup.", file=sys.stderr)
        return 1

    if not settings.dataset_path.is_file() or not settings.processed_data_dir.is_dir():
        print("Diretórios de dados incompletos; confira o checkout do projeto.", file=sys.stderr)
        return 1

    print(
        json.dumps(
            {
                "python": sys.version.split()[0],
                "dependencies": versions,
                "dataset_path": str(settings.dataset_path),
                "processed_data_dir": str(settings.processed_data_dir),
                "team_ids": settings.team_ids,
                "metrics": settings.metrics,
                "schema_version": settings.schema_version,
                "analysis_version": settings.analysis_version,
            },
            indent=2,
        )
    )
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
