"""Duas computações independentes; compara bytes de artefatos e manifesto determinístico."""

from backend.app.config import Settings, settings
from backend.artifacts.build import build_dataset
from backend.artifacts.serialization import canonical_bytes
from backend.artifacts.validation import require


def verify_reproducibility(config: Settings = settings) -> dict:
    first = build_dataset(config, publish=False)["manifest"]
    second = build_dataset(config, publish=False)["manifest"]

    def deterministic(manifest):
        return {key: value for key, value in manifest.items() if key != "generated_at"}

    require(
        canonical_bytes(deterministic(first)) == canonical_bytes(deterministic(second)),
        "Builds independentes produziram conteúdo diferente.",
    )
    report = {
        "status": "passed",
        "release_id": first["release_id"],
        "artifact_count": len(first["artifacts"]),
        "artifact_hashes_equal": True,
        "excluded_manifest_fields": ["generated_at"],
        "generation_timestamps": [first["generated_at"], second["generated_at"]],
        "source_tree_sha256": first["code"]["source_tree_sha256"],
        "dataset_sha256": first["source"]["sha256"],
    }
    (config.processed_data_dir / "reproducibility.json").write_bytes(canonical_bytes(report))
    return report
