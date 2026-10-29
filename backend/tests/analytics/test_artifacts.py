"""Publicação completa, rejeição de corrupção e reprodução independente do build."""

import json
import shutil
from dataclasses import replace

import pytest

from backend.app.config import Settings, settings
from backend.artifacts.build import build_dataset
from backend.artifacts.models import ARTIFACT_MODELS, CanonicalRow
from backend.artifacts.package import package_runtime
from backend.artifacts.reproducibility import verify_reproducibility
from backend.artifacts.serialization import ArtifactError, canonical_bytes, digest, validate_model
from backend.artifacts.validation import release_identity, validate_release
from backend.repositories.artifacts import ArtifactRepository

pytestmark = pytest.mark.analytics


def configured_root(path):
    config = Settings(project_root=path)
    config.raw_data_dir.mkdir(parents=True)
    config.dataset_path.write_bytes(settings.dataset_path.read_bytes())
    return config


@pytest.fixture(scope="module")
def published(tmp_path_factory):
    config = configured_root(tmp_path_factory.mktemp("published"))
    build_dataset(config)
    return config


@pytest.fixture
def copied(published, tmp_path):
    config = configured_root(tmp_path)
    shutil.copytree(published.processed_data_dir, config.processed_data_dir)
    return config


def reseal(path, filename):
    """Hash consistente não deve ser suficiente para aprovar dados semanticamente inválidos."""
    manifest = json.loads((path / "manifest.json").read_text())
    payload = (path / filename).read_bytes()
    manifest["artifacts"][filename].update(sha256=digest(payload), size_bytes=len(payload))
    manifest["release_id"] = release_identity(manifest)
    (path / "manifest.json").write_bytes(canonical_bytes(manifest))


def test_complete_release_has_hashes_schemas_provenance_and_readonly_access(published):
    repository = ArtifactRepository(config=published, profile="build")
    manifest = repository.manifest
    assert len(manifest["artifacts"]) == 13
    assert manifest["source"]["sha256"] == settings.expected_dataset_sha256
    assert manifest["code"]["git_commit"]
    assert manifest["code"]["files"]["uv.lock"]
    assert manifest["environment"]["numerical_threads"] == "1"
    assert manifest["feature_order"] == list(settings.metrics)
    assert manifest["generated_at"].endswith("Z")
    assert len(repository.get("games.json")["rows"]) == 2238
    assert len(repository.get("descriptives.json")["results"]) == 14
    assert len(repository.get("anomalies.json")["results"]) == 50
    content = repository.get("content.json")
    assert content["interpretation_status"] == "pending_stage_9"
    assert content["provenance"]["extracted_at"] is None
    assert "BSD 2-Clause" in content["licenses"]["pyod_ecod_reference"]
    changed = repository.get("games.json")
    changed["rows"].clear()
    assert len(repository.get("games.json")["rows"]) == 2238


def test_repeated_publication_reuses_immutable_release_and_identical_pointer(copied):
    before = copied.current_pointer_path.read_bytes()
    repository = ArtifactRepository(config=copied)
    existing_manifest = (repository.release_path / "manifest.json").read_bytes()
    outcome = build_dataset(copied)
    assert outcome["reused"] is True
    assert copied.current_pointer_path.read_bytes() == before
    assert (repository.release_path / "manifest.json").read_bytes() == existing_manifest


def test_independent_builds_compare_all_artifacts_without_publishing(tmp_path):
    config = configured_root(tmp_path)
    report = verify_reproducibility(config)
    assert report["status"] == "passed" and report["artifact_count"] == 13
    assert report["artifact_hashes_equal"] is True
    assert report["excluded_manifest_fields"] == ["generated_at"]
    assert not config.current_pointer_path.exists()
    assert not config.releases_dir.exists()


def test_invalid_new_source_preserves_previous_valid_release(copied):
    before = copied.current_pointer_path.read_bytes()
    original = copied.dataset_path.read_bytes()
    changed = original.replace(b"ATL vs. SAC", b"ATL vs. BOS", 1)
    copied.dataset_path.write_bytes(changed)
    new_config = replace(copied, expected_dataset_sha256=digest(changed))
    with pytest.raises(ArtifactError, match="Qualidade bloqueada"):
        build_dataset(new_config)
    assert copied.current_pointer_path.read_bytes() == before
    assert ArtifactRepository(config=copied).manifest["source"]["sha256"] == digest(original)
    assert not list(copied.processed_data_dir.glob(".build-*"))


def test_incomplete_staging_never_updates_current(copied, monkeypatch):
    from backend.artifacts import build

    before = copied.current_pointer_path.read_bytes()
    materialize = build._materialize

    def broken(*args):
        manifest = materialize(*args)
        (args[0] / "content.json").unlink()
        return manifest

    monkeypatch.setattr(build, "_materialize", broken)
    with pytest.raises(ArtifactError, match="ausente"):
        build_dataset(copied)
    assert copied.current_pointer_path.read_bytes() == before


def test_pointer_write_failure_does_not_expose_a_partial_release(copied, monkeypatch):
    from backend.artifacts import build

    before = copied.current_pointer_path.read_bytes()

    def broken_pointer(*args):
        raise OSError("Simulated pointer write failure")

    monkeypatch.setattr(build, "atomic_pointer", broken_pointer)
    with pytest.raises(OSError, match="Simulated"):
        build_dataset(replace(copied, analysis_version="1.0.1"))
    assert copied.current_pointer_path.read_bytes() == before
    ArtifactRepository(config=copied)
    # O release novo pode existir sem referência; qualquer pasta promovida está completa.
    for release in copied.releases_dir.iterdir():
        assert (release / "manifest.json").is_file()
        assert set(ARTIFACT_MODELS) <= {p.name for p in release.iterdir()}


@pytest.mark.parametrize("filename", ["content.json", "anomalies.json", "canonical.parquet"])
def test_missing_or_corrupt_file_is_rejected(copied, filename):
    repository = ArtifactRepository(config=copied)
    path = repository.release_path / filename
    path.unlink()
    with pytest.raises(ArtifactError):
        ArtifactRepository(config=copied, profile="build")


@pytest.mark.parametrize(
    "mutation,filename,error",
    [
        ("numeric_string", "games.json", "Contrato"),
        ("extra_field", "descriptives.json", "Contrato"),
        ("matrix_cell", "comparisons.json", "Quadro"),
        ("histogram", "distributions.json", "Histograma"),
        ("anomaly_flag", "anomalies.json", "Contagem"),
        ("nested_nan", "content.json", "JSON"),
        ("missing_coverage", "quality.json", "Estrutura interna"),
        ("duplicate_key", "content.json", "repetida"),
    ],
)
def test_matching_hashes_do_not_bypass_schema_or_cross_file_invariants(
    copied, mutation, filename, error
):
    directory = ArtifactRepository(config=copied).release_path
    path = directory / filename
    payload = json.loads(path.read_text())
    if mutation == "numeric_string":
        payload["rows"][0]["points"] = str(payload["rows"][0]["points"])
    elif mutation == "extra_field":
        payload["results"][0]["invented"] = 1
    elif mutation == "matrix_cell":
        cell = payload["matrices"]["cv"]["rows"][0]["teams"][settings.team_ids[0]]
        cell["value"] += 1
    elif mutation == "histogram":
        payload["metrics"][0]["teams"][0]["histogram"]["counts"][0] += 1
    elif mutation == "anomaly_flag":
        record = payload["results"][0]["records"][0]
        record["is_outlier"] = not record["is_outlier"]
    elif mutation == "missing_coverage":
        payload["report"]["coverage"].pop("rows")
    elif mutation == "nested_nan":
        payload["methodology"]["bad"] = float("nan")
    if mutation == "duplicate_key":
        encoded = path.read_bytes().replace(
            b'"kind":"content"', b'"kind":"content","kind":"content"'
        )
        path.write_bytes(encoded)
    else:
        path.write_text(json.dumps(payload, ensure_ascii=False, allow_nan=True))
    reseal(directory, filename)
    with pytest.raises(ArtifactError, match=error):
        validate_release(directory, copied)


def test_runtime_package_is_complete_without_parquet_or_raw_input(copied):
    result = package_runtime(copied)
    assert result["parquet_included"] is False
    assert len(result["json_files"]) == 10
    assert not list(copied.runtime_package_dir.rglob("*.parquet"))
    copied.dataset_path.unlink()
    repository = ArtifactRepository(copied.runtime_package_dir, copied)
    assert len(repository.get("games.json")["rows"]) == 2238
    with pytest.raises(ArtifactError):
        ArtifactRepository(copied.runtime_package_dir, copied, profile="build")


def test_version_mismatch_and_pointer_traversal_fail_explicitly(copied):
    with pytest.raises(ArtifactError, match="Análise incompatível"):
        ArtifactRepository(config=replace(copied, analysis_version="2.0.0"))
    pointer = json.loads(copied.current_pointer_path.read_text())
    pointer["release_id"] = "../../raw"
    copied.current_pointer_path.write_text(json.dumps(pointer))
    with pytest.raises(ArtifactError, match="Contrato CurrentPointer"):
        ArtifactRepository(config=copied)


def test_canonical_row_schema_rejects_boolean_counts_and_missing_required_fields():
    from backend.analytics.ingestion import ingest

    row = ingest().canonical.iloc[0].to_dict()
    row["points"] = True
    with pytest.raises(ArtifactError):
        validate_model(CanonicalRow, row)
    row["points"] = 1
    row.pop("team_id")
    with pytest.raises(ArtifactError):
        validate_model(CanonicalRow, row)
