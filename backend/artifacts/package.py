"""Exporta somente o subconjunto JSON; mantém a mesma identidade e manifesto."""

import shutil
from pathlib import Path
from tempfile import TemporaryDirectory

from backend.app.config import Settings, settings
from backend.artifacts.build import atomic_pointer
from backend.artifacts.validation import require, validate_release
from backend.repositories.artifacts import ArtifactRepository


def package_runtime(config: Settings = settings) -> dict:
    source = ArtifactRepository(config=config, profile="build")
    root = config.runtime_package_dir.resolve()
    raw = config.raw_data_dir.resolve()
    require(
        not root.is_relative_to(raw) and not raw.is_relative_to(root),
        "Pacote sobrepõe dados brutos.",
    )
    root.mkdir(parents=True, exist_ok=True)
    releases = root / "releases"
    releases.mkdir(exist_ok=True)
    require(releases.resolve().is_relative_to(root), "Releases do pacote escapam da saída.")
    destination = releases / source.manifest["release_id"]
    files = [name for name, entry in source.manifest["artifacts"].items() if entry["runtime"]]
    with TemporaryDirectory(prefix=".runtime-", dir=root) as directory:
        staged = Path(directory) / "release"
        staged.mkdir()
        for name in [*files, "manifest.json"]:
            shutil.copyfile(source.release_path / name, staged / name)
        validate_release(staged, config, profile="runtime")
        try:
            staged.rename(destination)
        except OSError:
            if not destination.is_dir():
                raise
            validate_release(destination, config, profile="runtime")
        atomic_pointer(
            root, source.manifest["release_id"], (destination / "manifest.json").read_bytes()
        )
    ArtifactRepository(root, config)
    return {
        "status": "passed",
        "path": str(root),
        "release_id": source.manifest["release_id"],
        "json_files": files,
        "parquet_included": False,
    }
