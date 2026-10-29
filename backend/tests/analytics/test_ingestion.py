"""Contratos de entrada e preservação dos dados durante a normalização."""

import csv
import hashlib
import io
from dataclasses import replace
from datetime import date

import pandas as pd
import pyarrow as pa
import pytest

from backend.analytics.ingestion import (
    DatasetValidationError,
    ingest,
    normalize_frame,
    read_source,
    select_features,
    select_focus,
)
from backend.analytics.metrics import COLUMNS, feature_columns, get_metric
from backend.app.config import Settings, settings
from backend.scripts.normalize_data import normalize_data

pytestmark = pytest.mark.analytics


@pytest.fixture
def row():
    return {
        "Team_ID": "1610612737",
        "Game_ID": "0022501078",
        "GAME_DATE": "2026-03-28",
        "MATCHUP": "ATL vs. SAC",
        "WL": "1",
        "W": "42",
        "L": "33",
        "W_PCT": "0.56",
        "MIN": "240",
        "FGM": "45",
        "FGA": "89",
        "FG_PCT": "0.506",
        "FG3M": "16",
        "FG3A": "41",
        "FG3_PCT": "0.39",
        "FTM": "17",
        "FTA": "22",
        "FT_PCT": "0.773",
        "OREB": "13",
        "DREB": "27",
        "REB": "40",
        "AST": "34",
        "STL": "10",
        "BLK": "0",
        "TOV": "13",
        "PF": "12",
        "PTS": "123",
        "TEAM_NAME": "Atlanta Hawks",
    }


def write_csv(path, rows, header=None):
    stream = io.StringIO(newline="")
    writer = csv.DictWriter(stream, fieldnames=header or list(rows[0]))
    writer.writeheader()
    writer.writerows(rows)
    payload = stream.getvalue().encode("utf-8")
    path.write_bytes(payload)
    return payload


def test_snapshot_preserves_ids_literals_and_identifies_exact_bytes(tmp_path, row):
    row["TEAM_NAME"] = "NA"
    path = tmp_path / "input.csv"
    payload = write_csv(path, [row])

    raw, source = read_source(path)
    normalized = normalize_frame(raw)

    assert source.sha256 == hashlib.sha256(payload).hexdigest()
    assert source.size_bytes == len(payload)
    assert (source.row_count, source.column_count) == (1, 28)
    assert normalized.loc[0, "game_id"] == "0022501078"
    assert normalized.loc[0, "team_name"] == "NA"
    assert normalized.loc[0, "game_date"] == date(2026, 3, 28)
    assert normalized.game_date.dtype == pd.ArrowDtype(pa.date32())
    assert normalized.won.dtype == pd.BooleanDtype()
    assert bool(normalized.loc[0, "won"]) is True
    assert str(normalized.points.dtype) == "Int64"
    assert str(normalized.field_goal_rate.dtype) == "Float64"
    assert path.read_bytes() == payload


@pytest.mark.parametrize("mutation", ["missing", "extra", "duplicate", "short", "long", "empty"])
def test_rejects_incompatible_schema_or_record_width(tmp_path, row, mutation):
    path = tmp_path / "input.csv"
    payload = write_csv(path, [row]).decode()
    header, record = payload.splitlines()
    if mutation == "missing":
        payload = ",".join(header.split(",")[:-1]) + "\n" + ",".join(record.split(",")[:-1])
    elif mutation == "extra":
        payload = header + ",unknown\n" + record + ",value"
    elif mutation == "duplicate":
        payload = header + ",Team_ID\n" + record + ",1"
    elif mutation == "short":
        payload = header + "\n" + ",".join(record.split(",")[:-1])
    elif mutation == "long":
        payload = header + "\n" + record + ",unexpected"
    else:
        payload = ""
    path.write_text(payload)
    with pytest.raises(DatasetValidationError):
        read_source(path)


def test_rejects_malformed_quoted_csv(tmp_path, row):
    path = tmp_path / "input.csv"
    header = ",".join(row)
    path.write_text(header + '\n"unterminated')
    with pytest.raises(DatasetValidationError, match="CSV malformado"):
        read_source(path)


@pytest.mark.parametrize(
    ("column", "invalid"),
    [
        ("Team_ID", "1.0"),
        ("Game_ID", ""),
        ("Team_ID", " 1610612737"),
        ("WL", "2"),
        ("WL", "W"),
        ("WL", "false"),
        ("GAME_DATE", "2026-02-30"),
        ("GAME_DATE", "2026-2-01"),
        ("GAME_DATE", "2026-01-01T00:00:00Z"),
        ("PTS", "12.5"),
        ("W", "-1"),
        ("L", "two"),
        ("PTS", str(2**64)),
        ("FG_PCT", "inf"),
        ("W_PCT", "NaN"),
        ("FG_PCT", "1.01"),
    ],
)
def test_invalid_types_are_not_coerced_to_missing(tmp_path, row, column, invalid):
    row[column] = invalid
    path = tmp_path / "input.csv"
    write_csv(path, [row])
    raw, _ = read_source(path)
    with pytest.raises(DatasetValidationError, match=column):
        normalize_frame(raw)


def test_preserves_missing_zeros_extremes_and_duplicate_rows(tmp_path, row):
    row.update({"AST": "", "GAME_DATE": "", "PTS": "999", "WL": "0"})
    path = tmp_path / "input.csv"
    write_csv(path, [row, row])
    raw, _ = read_source(path)

    canonical = normalize_frame(raw)

    assert len(canonical) == 2
    assert canonical.assists.isna().all()
    assert canonical.game_date.isna().all()
    assert canonical.blocks.eq(0).all()
    assert canonical.points.eq(999).all()
    assert canonical.won.eq(False).all()  # noqa: E712


def test_accepts_reordered_columns_and_sorts_without_mutating_raw(tmp_path, row):
    earlier = {**row, "GAME_DATE": "2025-10-22", "Game_ID": "0000000001"}
    path = tmp_path / "input.csv"
    write_csv(path, [row, earlier], header=list(reversed(row)))
    raw, _ = read_source(path)
    original = raw.copy(deep=True)

    canonical = normalize_frame(raw)

    assert canonical.game_id.tolist() == ["0000000001", "0022501078"]
    assert len(canonical.columns) == 28
    pd.testing.assert_frame_equal(raw, original)


def test_nullable_columns_preserve_empty_cells_without_imputation(tmp_path, row):
    row.update({"WL": "", "FG_PCT": "", "W": "", "TEAM_NAME": ""})
    path = tmp_path / "input.csv"
    write_csv(path, [row])
    raw, _ = read_source(path)

    canonical = normalize_frame(raw)

    assert canonical[["won", "field_goal_rate", "cumulative_wins", "team_name"]].isna().all().all()
    assert str(canonical.won.dtype) == "boolean"
    assert str(canonical.field_goal_rate.dtype) == "Float64"
    assert str(canonical.cumulative_wins.dtype) == "Int64"


def test_focus_and_features_preserve_order_and_exclude_context(tmp_path, row):
    houston = {**row, "Team_ID": "1610612745", "TEAM_NAME": "Houston Rockets"}
    other = {**row, "Team_ID": "1610612758", "TEAM_NAME": "Sacramento Kings"}
    path = tmp_path / "input.csv"
    write_csv(path, [other, houston, row])
    raw, _ = read_source(path)
    canonical = normalize_frame(raw)

    focus = select_focus(canonical)
    features = select_features(focus)

    assert len(canonical) == 3
    assert focus.team_id.tolist() == list(settings.team_ids)
    assert features.columns.tolist() == [
        "points",
        "rebounds",
        "assists",
        "steals",
        "blocks",
        "personal_fouls",
        "three_pointers_made",
    ]
    assert features.index.equals(focus.index)
    assert set(feature_columns()) == {c.canonical for c in COLUMNS if c.analysis_eligible}
    assert all(c.exclusion_reason for c in COLUMNS if not c.analysis_eligible)
    assert len({c.canonical for c in COLUMNS}) == 28
    with pytest.raises(ValueError, match="fora do escopo"):
        get_metric("WL")
    with pytest.raises(DatasetValidationError, match="Times principais ausentes"):
        select_focus(canonical[canonical.team_id.eq(settings.team_ids[0])])


def test_mismatched_provenance_blocks_output(tmp_path, row):
    config = Settings(project_root=tmp_path)
    config.raw_data_dir.mkdir(parents=True)
    write_csv(config.dataset_path, [row])

    with pytest.raises(DatasetValidationError, match="SHA-256 divergente"):
        normalize_data(config)

    assert not config.processed_data_dir.exists()


def test_parquet_roundtrip_and_repeated_normalization_preserve_source(tmp_path, row):
    config = Settings(project_root=tmp_path)
    config.raw_data_dir.mkdir(parents=True)
    houston = {**row, "Team_ID": "1610612745", "TEAM_NAME": "Houston Rockets"}
    payload = write_csv(config.dataset_path, [houston, row])
    config = replace(config, expected_dataset_sha256=hashlib.sha256(payload).hexdigest())

    expected = ingest(config)
    first = normalize_data(config)
    second = normalize_data(config)

    assert first == second
    assert first["status"] == "normalized_pending_quality_validation"
    pd.testing.assert_frame_equal(
        pd.read_parquet(config.ingestion_dir / "canonical.parquet"), expected.canonical
    )
    pd.testing.assert_frame_equal(
        pd.read_parquet(config.ingestion_dir / "focus.parquet"), expected.focus
    )
    assert config.dataset_path.read_bytes() == payload


def test_refuses_output_symlink_into_raw(tmp_path):
    config = Settings(project_root=tmp_path)
    config.raw_data_dir.mkdir(parents=True)
    config.processed_data_dir.symlink_to(config.raw_data_dir, target_is_directory=True)
    with pytest.raises(DatasetValidationError, match="sobrepor"):
        normalize_data(config)


def test_real_dataset_matches_documented_coverage_and_preserves_all_fields():
    original = settings.dataset_path.read_bytes()
    result = ingest()

    assert result.source.sha256 == settings.expected_dataset_sha256
    assert result.source.size_bytes == 309357
    assert result.canonical.shape == (2238, 28)
    assert result.canonical.team_id.nunique() == 30
    assert result.focus.shape == (149, 28)
    assert result.focus.groupby("team_id").size().to_dict() == dict(
        zip(settings.team_ids, [75, 74], strict=True)
    )
    assert result.features.shape == (149, 7)
    assert result.canonical.game_date.min() == date(2025, 10, 21)
    assert result.canonical.game_date.max() == date(2026, 3, 29)
    assert result.canonical.blocks.eq(0).sum() == 33
    assert result.canonical.steals.eq(0).sum() == 1
    assert settings.dataset_path.read_bytes() == original
