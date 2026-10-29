"""Leitor readonly de releases: stdlib/Pydantic, sem importar o pipeline."""

from copy import deepcopy
from pathlib import Path

from backend.app.config import Settings, settings
from backend.artifacts.models import ARTIFACT_MODELS, CurrentPointer
from backend.artifacts.serialization import ArtifactError, digest, read_json, validate_model
from backend.artifacts.validation import require, validate_release


class ArtifactRepository:
    def __init__(self, root: Path | None = None, config: Settings = settings, *, profile="runtime"):
        self.root = (root if root is not None else config.processed_data_dir).resolve()
        pointer = validate_model(CurrentPointer, read_json(self.root / "current.json"))
        releases = (self.root / "releases").resolve()
        require(releases.is_relative_to(self.root), "Diretório de releases escapa do pacote.")
        path = (releases / pointer["release_id"]).resolve()
        require(
            path.parent == releases and path.name == pointer["release_id"],
            "Caminho de release inválido.",
        )
        try:
            manifest_bytes = (path / "manifest.json").read_bytes()
        except OSError as error:
            raise ArtifactError("Manifesto publicado ausente.") from error
        require(
            digest(manifest_bytes) == pointer["manifest_sha256"],
            "Hash do manifesto difere do ponteiro.",
        )
        manifest, documents = validate_release(path, config, profile=profile)
        require(manifest["release_id"] == pointer["release_id"], "Identidade difere do ponteiro.")
        self.release_path = path
        self.manifest = manifest
        self._documents = documents

    def get(self, name: str) -> dict:
        if name not in ARTIFACT_MODELS:
            raise ArtifactError(f"Artefato não disponível no runtime: {name}.")
        return deepcopy(self._documents[name])
