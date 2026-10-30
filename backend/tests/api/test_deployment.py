"""Pacote mínimo e navegação SPA sem mascarar erros da API ou de assets."""

import json
import runpy
import shutil
from dataclasses import replace

import pytest
from fastapi.testclient import TestClient

from backend.app.config import Settings, settings
from backend.artifacts.build import build_dataset
from backend.artifacts.serialization import ArtifactError, digest
from backend.repositories.artifacts import ArtifactRepository
from backend.scripts.prepare_deployment import prepare_deployment

pytestmark = pytest.mark.api


@pytest.fixture(scope="module")
def deployment_source(tmp_path_factory):
    root = tmp_path_factory.mktemp("deploy-source")
    config = Settings(project_root=root)
    config.raw_data_dir.mkdir(parents=True)
    config.dataset_path.write_bytes(settings.dataset_path.read_bytes())
    for name in ["requirements-runtime.txt", ".python-version"]:
        shutil.copyfile(settings.project_root / name, root / name)
    shutil.copytree(
        settings.project_root / "backend",
        root / "backend",
        ignore=shutil.ignore_patterns("__pycache__", "tests"),
    )
    shutil.copytree(settings.project_root / "deployment", root / "deployment")
    frontend = root / "frontend/dist"
    frontend.mkdir(parents=True)
    (frontend / "index.html").write_text('<html lang="pt-BR"><body>QuadraScope SPA</body></html>')
    (frontend / "assets").mkdir()
    (frontend / "assets/app.js").write_text("console.log('app')")
    build_dataset(config)
    return config


@pytest.fixture
def source(deployment_source, tmp_path):
    shutil.copytree(deployment_source.project_root, tmp_path, dirs_exist_ok=True)
    return replace(deployment_source, project_root=tmp_path)


def test_minimal_package_keeps_hashes_and_excludes_offline_sources(source):
    result = prepare_deployment(source)
    root = source.project_root / ".deployment"
    repository = ArtifactRepository(config=replace(source, project_root=root))
    assert result["release_id"] == repository.manifest["release_id"]
    assert result["cloud_verified"] is False
    assert not list(root.rglob("*.parquet")) and not list(root.rglob("*.csv"))
    assert not (root / "backend/analytics/multivariate_anomalies.py").exists()
    assert not (root / "backend/scripts").exists()
    assert not (root / "backend/tests").exists()
    for name, checksum in result["files"].items():
        assert digest((root / name).read_bytes()) == checksum
    assert "scikit-learn" not in (root / "pyproject.toml").read_text()
    assert "pyarrow" not in (root / "requirements.txt").read_text()


def test_invalid_input_does_not_destroy_previous_package(source):
    prepare_deployment(source)
    manifest = source.project_root / ".deployment/package-manifest.json"
    before = manifest.read_bytes()
    (source.project_root / "frontend/dist/index.html").unlink()
    with pytest.raises(ArtifactError, match="web-build"):
        prepare_deployment(source)
    assert manifest.read_bytes() == before


def test_reserved_output_without_generation_marker_is_not_removed(source):
    output = source.project_root / ".deployment"
    output.mkdir()
    (output / "user.txt").write_text("preserve")
    with pytest.raises(ArtifactError, match="não foi gerada"):
        prepare_deployment(source)
    assert (output / "user.txt").read_text() == "preserve"


def test_spa_fallback_keeps_api_404_and_static_asset_semantics(source, monkeypatch):
    from backend.app import main

    prepare_deployment(source)
    root = source.project_root / ".deployment"
    factory = main.create_app
    monkeypatch.setattr(main, "create_app", lambda: factory(replace(source, project_root=root)))
    application = runpy.run_path(str(root / "app.py"))["app"]
    with TestClient(application) as client:
        assert client.get("/api/v1/health").json()["status"] == "ready"
        response = client.get("/times/1610612745?venue=home", headers={"Accept": "text/html"})
        assert response.status_code == 200 and "QuadraScope SPA" in response.text
        assert client.get("/assets/app.js").status_code == 200
        assert client.get("/assets/missing.js", headers={"Accept": "text/html"}).status_code == 404
        response = client.get("/api/v1/missing", headers={"Accept": "text/html"})
        assert response.status_code == 404 and response.json()["error"]["code"] == "not_found"
        assert len(json.loads(client.get("/openapi.json").text)["paths"]) == 10
