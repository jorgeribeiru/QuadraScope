"""Prepara pacote mínimo, validado e independente para prova local e publicação."""

import json
import re
import shutil
from pathlib import Path
from tempfile import TemporaryDirectory

from backend.app.config import Settings, settings
from backend.artifacts.models import ARTIFACT_MODELS
from backend.artifacts.serialization import canonical_bytes, digest
from backend.artifacts.validation import require
from backend.repositories.artifacts import ArtifactRepository

RUNTIME_MODULES = {
    "app": ("config", "main", "queries", "schemas", "services", "telemetry"),
    "analytics": ("metrics", "descriptive", "distributions", "comparisons", "interpretations"),
    "artifacts": ("models", "serialization", "validation"),
    "repositories": ("artifacts",),
}


def prepare_deployment(config: Settings = settings) -> dict:
    project = config.project_root
    repository = ArtifactRepository(config=config)
    frontend = project / "frontend/dist"
    require((frontend / "index.html").is_file(), "Execute make web-build antes de empacotar.")
    destination = project / ".deployment"
    require(not destination.is_symlink(), "A saída de deploy não pode ser um link simbólico.")
    require(
        not destination.exists() or (destination / "package-manifest.json").is_file(),
        "A saída existente não foi gerada pelo empacotador.",
    )
    with TemporaryDirectory(prefix=".deploy-", dir=project) as directory:
        stage = Path(directory) / "package"
        stage.mkdir()
        shutil.copytree(frontend, stage / "web")
        for path in ["app.py", "vercel.json"]:
            shutil.copyfile(project / "deployment" / path, stage / path)
        shutil.copyfile(project / ".python-version", stage / ".python-version")
        requirements = (project / "requirements-runtime.txt").read_text()
        (stage / "requirements.txt").write_text(requirements)
        pinned = re.findall(r"^([a-zA-Z0-9_.-]+==[^\s;\\]+)", requirements, flags=re.MULTILINE)
        require(len(pinned) >= 6, "Export de runtime incompleto.")
        pyproject = (
            '[project]\nname = "quadrascope-deployment"\nversion = "0.1.0"\n'
            'requires-python = ">=3.12,<3.13"\ndependencies = '
            + json.dumps(pinned)
            + '\n\n[tool.vercel]\nentrypoint = "app:app"\n'
            + "\n[tool.vercel.fastapi.static]\ncdn = true\n"
        )
        (stage / "pyproject.toml").write_text(pyproject)
        (stage / "backend").mkdir()
        shutil.copyfile(project / "backend/__init__.py", stage / "backend/__init__.py")
        for package, modules in RUNTIME_MODULES.items():
            output = stage / "backend" / package
            output.mkdir()
            for name in ("__init__", *modules):
                shutil.copyfile(project / "backend" / package / f"{name}.py", output / f"{name}.py")
        data = stage / "data/processed"
        data.mkdir(parents=True)
        release = repository.manifest["release_id"]
        output_release = data / "releases" / release
        output_release.mkdir(parents=True)
        for filename in ["manifest.json", *ARTIFACT_MODELS]:
            shutil.copyfile(repository.release_path / filename, output_release / filename)
        shutil.copyfile(config.current_pointer_path, data / "current.json")
        ArtifactRepository(data, config)
        files = {
            str(path.relative_to(stage)): digest(path.read_bytes())
            for path in sorted(stage.rglob("*"))
            if path.is_file()
        }
        report = {
            "status": "passed",
            "release_id": release,
            "files": files,
            "source_size_bytes": sum(
                path.stat().st_size for path in stage.rglob("*") if path.is_file()
            ),
            "topology": "single_origin_fastapi_static_react",
            "cloud_verified": False,
        }
        (stage / "package-manifest.json").write_bytes(canonical_bytes(report))
        # A pasta contém somente saída gerada; nunca remover dados de entrada ou um symlink.
        if destination.exists():
            shutil.rmtree(destination)
        stage.rename(destination)
    return {**report, "path": str(destination)}


if __name__ == "__main__":
    result = prepare_deployment()
    print(f"Pacote local validado: {result['path']}; {result['source_size_bytes']} bytes.")
