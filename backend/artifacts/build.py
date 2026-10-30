"""Build offline a partir de um único snapshot; promoção só após validação integral."""

import os
import platform
import subprocess
from dataclasses import asdict
from datetime import UTC, datetime
from importlib.metadata import version
from pathlib import Path
from tempfile import TemporaryDirectory

import pyarrow as pa
import pyarrow.parquet as pq
from threadpoolctl import threadpool_limits

from backend.analytics.anomaly_reports import anomaly_reports
from backend.analytics.comparisons import descriptive_reports
from backend.analytics.ingestion import ingest, select_focus
from backend.analytics.interpretations import describe_results
from backend.analytics.metrics import COLUMNS
from backend.analytics.quality import audit_quality
from backend.analytics.sensitivity import sensitivity_report
from backend.app.config import Settings, settings
from backend.artifacts.models import ARTIFACT_MODELS, PARQUET_MODELS, Manifest
from backend.artifacts.parquet import parquet_schema
from backend.artifacts.serialization import (
    canonical_bytes,
    digest,
    read_json,
    validate_model,
)
from backend.artifacts.validation import release_identity, require, schema_models, validate_release
from backend.scripts.detect_anomalies import load_parameters

CODE_ROOT = Path(__file__).resolve().parents[2]
DEPENDENCIES = (
    "numpy",
    "pandas",
    "scipy",
    "pyarrow",
    "scikit-learn",
    "pydantic",
    "fastapi",
    "uvicorn",
    "threadpoolctl",
)
RUNTIME_DEPENDENCIES = ("numpy", "pandas", "scipy", "pydantic", "fastapi", "uvicorn")


def code_identity() -> dict:
    paths = [
        *CODE_ROOT.glob("backend/**/*.py"),
        *CODE_ROOT.glob("backend/content/*.json"),
        *CODE_ROOT.glob("backend/tests/fixtures/*.json"),
    ]
    paths += [
        CODE_ROOT / name
        for name in (
            "pyproject.toml",
            "uv.lock",
            "requirements.txt",
            "requirements-runtime.txt",
            ".python-version",
        )
    ]
    paths.append(CODE_ROOT / "docs/references/pyod-ecod-LICENSE.txt")
    files = {
        str(path.relative_to(CODE_ROOT)): digest(path.read_bytes()) for path in sorted(set(paths))
    }
    try:
        commit = subprocess.check_output(
            ["git", "rev-parse", "HEAD"], cwd=CODE_ROOT, text=True, stderr=subprocess.DEVNULL
        ).strip()
        dirty = bool(
            subprocess.check_output(
                ["git", "status", "--porcelain", "--untracked-files=all"], cwd=CODE_ROOT, text=True
            )
        )
    except (OSError, subprocess.CalledProcessError):
        commit, dirty = None, None
    return {
        "git_commit": commit,
        "git_dirty": dirty,
        "source_tree_sha256": digest(canonical_bytes(files)),
        "files": files,
    }


def _compute(config: Settings):
    result = ingest(config)
    quality, enriched = audit_quality(result.canonical, config)
    require(quality["status"] == "passed", f"Qualidade bloqueada: {quality['failed_rules']}.")
    parameters = load_parameters(config)
    focus = select_focus(enriched, config)
    sensitivity = sensitivity_report(focus, config)
    selection = sensitivity["selection"]
    require(
        selection["dbscan_eps"] == parameters["dbscan_eps"]
        and selection["neighbor_k"] == parameters["neighbor_k"]
        and selection["scaler"] == parameters["scaler"]
        and selection["min_samples"] == parameters["dbscan_min_samples"],
        "Seleção diverge dos parâmetros revisados.",
    )
    dependencies = {name: version(name) for name in DEPENDENCIES}
    metadata = {
        "schema_version": config.schema_version,
        "analysis_version": config.analysis_version,
        "source": asdict(result.source),
        "team_ids": list(config.team_ids),
        "metric_codes": list(config.metrics),
        "parameter_version": parameters["version"],
        "parameters": parameters,
        "dependencies": dependencies,
    }
    reports = descriptive_reports(focus, config)
    payloads = {
        name + ".json": {"kind": name, "metadata": metadata, **body}
        for name, body in reports.items()
    }
    payloads["games.json"] = {
        "kind": "games",
        "metadata": metadata,
        "rows": enriched.to_dict(orient="records"),
    }
    payloads["quality.json"] = {"kind": "quality", "metadata": metadata, "report": quality}
    payloads["anomalies.json"] = {
        "kind": "anomalies",
        "metadata": metadata,
        **anomaly_reports(focus, parameters, config),
    }
    payloads["sensitivity.json"] = {"kind": "sensitivity", "metadata": metadata, **sensitivity}
    payloads["dictionary.json"] = {
        "kind": "dictionary",
        "metadata": metadata,
        "columns": [c.to_dict() for c in COLUMNS],
    }
    context = read_json(CODE_ROOT / "backend/content/report-context.json")
    payloads["content.json"] = {
        "kind": "content",
        "metadata": metadata,
        **context,
        "interpretation_status": "descriptive_available",
        "interpretations": describe_results(
            reports["descriptives"]["results"], focus.to_dict(orient="records")
        ),
        "missingness": read_json(CODE_ROOT / "backend/content/missingness.json"),
        "licenses": {
            "pyod_ecod_reference": (CODE_ROOT / "docs/references/pyod-ecod-LICENSE.txt").read_text()
        },
    }
    payloads["schemas.json"] = {"kind": "schemas", "metadata": metadata, "models": schema_models()}
    return payloads, metadata


def _materialize(bundle, payloads, metadata, code, config):
    bundle.mkdir()
    validated = {}
    inventory = {}
    for name, model in ARTIFACT_MODELS.items():
        data = validate_model(model, payloads[name])
        validated[name] = data
        encoded = canonical_bytes(data)
        (bundle / name).write_bytes(encoded)
        inventory[name] = {
            "sha256": digest(encoded),
            "size_bytes": len(encoded),
            "format": "json",
            "schema_name": model.__name__,
            "runtime": True,
        }
    games = validated["games.json"]["rows"]
    fields = [c.canonical for c in COLUMNS]
    records = {
        "canonical.parquet": [{k: r[k] for k in fields} for r in games],
        "games.parquet": games,
        "focus.parquet": [r for r in games if r["team_id"] in config.team_ids],
    }
    for name, model in PARQUET_MODELS.items():
        # Arrow recebe date32 reais após validar os contratos JSON, não timestamps inferidos.
        rows = [
            model.model_validate_json(canonical_bytes(row)).model_dump() for row in records[name]
        ]
        table = pa.Table.from_pylist(rows, schema=parquet_schema(name != "canonical.parquet"))
        pq.write_table(table, bundle / name, compression="zstd", use_dictionary=True)
        data = (bundle / name).read_bytes()
        inventory[name] = {
            "sha256": digest(data),
            "size_bytes": len(data),
            "format": "parquet",
            "schema_name": model.__name__,
            "runtime": False,
        }
    manifest = {
        "manifest_version": "1.0.0",
        "schema_version": config.schema_version,
        "analysis_version": config.analysis_version,
        "source": metadata["source"],
        "code": code,
        "dependencies": metadata["dependencies"],
        "environment": {
            "python": platform.python_version(),
            "implementation": platform.python_implementation(),
            "system": platform.system(),
            "machine": platform.machine(),
            "numerical_threads": "1",
        },
        "parameters": metadata["parameters"],
        "feature_order": list(config.metrics),
        "team_ids": list(config.team_ids),
        "artifacts": inventory,
        "runtime_policy": {
            "format": "json",
            "dependencies": list(RUNTIME_DEPENDENCIES),
            "offline_only": ["pyarrow", "scikit-learn", "threadpoolctl"],
            "filtered_descriptives": "pandas/numpy/scipy on games.json",
            "raw_csv_required": False,
            "parquet_required": False,
        },
    }
    manifest["release_id"] = release_identity(manifest)
    manifest["generated_at"] = datetime.now(UTC).isoformat()
    manifest = validate_model(Manifest, manifest)
    (bundle / "manifest.json").write_bytes(canonical_bytes(manifest))
    return manifest


def atomic_pointer(root: Path, release_id: str, manifest_bytes: bytes):
    pointer = {
        "schema_version": "1.0.0",
        "release_id": release_id,
        "manifest_sha256": digest(manifest_bytes),
    }
    with TemporaryDirectory(prefix=".pointer-", dir=root) as directory:
        temporary = Path(directory) / "current.json"
        with temporary.open("wb") as file:
            file.write(canonical_bytes(pointer))
            file.flush()
            os.fsync(file.fileno())
        os.replace(temporary, root / "current.json")


def build_dataset(config: Settings = settings, *, publish=True) -> dict:
    processed, raw = config.processed_data_dir.resolve(), config.raw_data_dir.resolve()
    require(
        not processed.is_relative_to(raw) and not raw.is_relative_to(processed),
        "Saída sobrepõe dados brutos.",
    )
    processed.mkdir(parents=True, exist_ok=True)
    code = code_identity()
    with TemporaryDirectory(prefix=".build-", dir=processed) as directory:
        bundle = Path(directory) / "release"
        with threadpool_limits(limits=1):
            payloads, metadata = _compute(config)
            manifest = _materialize(bundle, payloads, metadata, code, config)
            validate_release(bundle, config, profile="build")
        require(code_identity() == code, "Código/dependências mudaram durante o build.")
        require(
            digest(config.dataset_path.read_bytes()) == manifest["source"]["sha256"],
            "Fonte mudou durante o build.",
        )
        reused = False
        destination = None
        if publish:
            config.releases_dir.mkdir(parents=True, exist_ok=True)
            require(
                config.releases_dir.resolve().is_relative_to(processed),
                "Diretório de releases fora da saída.",
            )
            destination = config.releases_dir / manifest["release_id"]
            try:
                bundle.rename(destination)
            except OSError:
                if not destination.is_dir():
                    raise
                # Outro build idêntico pode ter publicado primeiro; nunca sobrescrever release.
                manifest, _ = validate_release(destination, config, profile="build")
                reused = True
            atomic_pointer(
                processed, manifest["release_id"], (destination / "manifest.json").read_bytes()
            )
        return {
            "status": "passed",
            "published": publish,
            "reused": reused,
            "release_id": manifest["release_id"],
            "path": str(destination) if destination else None,
            "manifest": manifest,
        }
