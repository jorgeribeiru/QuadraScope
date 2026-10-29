"""Verifica isolamento dos caminhos usados pelo pipeline e pela futura API."""

from pathlib import Path

import pytest

from backend.app.config import Settings, settings

pytestmark = pytest.mark.unit


def test_default_paths_do_not_depend_on_working_directory(monkeypatch, tmp_path):
    monkeypatch.chdir(tmp_path)

    config = Settings()

    assert config.dataset_path.is_absolute()
    assert config.dataset_path.is_file()
    assert config.project_root != Path.cwd()
    assert config.dataset_path == settings.dataset_path


def test_isolated_project_uses_its_own_data_without_creating_files(tmp_path):
    config = Settings(project_root=tmp_path)

    assert config.dataset_path.is_relative_to(tmp_path / "data" / "raw")
    assert config.processed_data_dir.is_relative_to(tmp_path / "data")
    assert not config.processed_data_dir.is_relative_to(config.raw_data_dir)
    assert not config.raw_data_dir.exists()
    assert not config.processed_data_dir.exists()
