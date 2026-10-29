"""O comando científico verifica a fonte e invalida saídas após falhas."""

import hashlib
import json
from dataclasses import replace

import pytest

from backend.app.config import Settings, settings
from backend.scripts.describe_data import describe_data

pytestmark = pytest.mark.analytics


@pytest.mark.parametrize("failure", ["hash", "parsing", "quality", "missing_file"])
def test_reports_have_source_identity_and_are_removed_after_failed_input(tmp_path, failure):
    config = Settings(project_root=tmp_path)
    config.raw_data_dir.mkdir(parents=True)
    original = settings.dataset_path.read_bytes()
    config.dataset_path.write_bytes(original)

    status = describe_data(config)
    assert status["status"] == "passed"
    assert status["source"]["sha256"] == settings.expected_dataset_sha256
    filenames = ["descriptives.json", "distributions.json", "comparisons.json"]
    for name in filenames:
        report = json.loads((config.descriptive_dir / name).read_text())
        assert report["metadata"]["source"]["sha256"] == status["source"]["sha256"]
        assert report["metadata"]["parameters"]["ddof"] == 1
    assert config.dataset_path.read_bytes() == original

    if failure == "quality":
        changed = original.replace(b"ATL vs. SAC", b"ATL vs. BOS", 1)
        assert changed != original
        config.dataset_path.write_bytes(changed)
    elif failure == "missing_file":
        config.dataset_path.unlink()
    else:
        config.dataset_path.write_bytes(original + b"invalid-record\n")
    if failure in {"parsing", "quality"}:
        config = replace(
            config,
            expected_dataset_sha256=hashlib.sha256(config.dataset_path.read_bytes()).hexdigest(),
        )
    status = describe_data(config)
    assert status["status"] == "blocked"
    assert all(not (config.descriptive_dir / name).exists() for name in filenames)
    persisted = json.loads((config.descriptive_dir / "status.json").read_text())
    assert persisted["status"] == "blocked" and persisted["reason"]
