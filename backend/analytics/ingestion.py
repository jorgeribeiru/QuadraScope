"""Leitura e normalização; auditoria entre campos/partidas pertence à etapa 3."""

import csv
import hashlib
import io
from collections import Counter
from dataclasses import asdict, dataclass
from pathlib import Path

import numpy as np
import pandas as pd
import pyarrow as pa

from backend.analytics.metrics import COLUMNS, ColumnSpec, feature_columns
from backend.app.config import Settings, settings


class DatasetValidationError(ValueError):
    """Entrada incompatível com o contrato de ingestão."""


@dataclass(frozen=True)
class SourceMetadata:
    filename: str
    sha256: str
    size_bytes: int
    row_count: int
    column_count: int
    encoding: str = "utf-8-sig"
    delimiter: str = ","


@dataclass
class IngestionResult:
    source: SourceMetadata
    canonical: pd.DataFrame
    focus: pd.DataFrame
    features: pd.DataFrame

    def report(self, config: Settings = settings) -> dict:
        return {
            "status": "normalized_pending_quality_validation",
            "schema_version": config.schema_version,
            "analysis_version": config.analysis_version,
            "source": asdict(self.source),
            "canonical": {
                "rows": len(self.canonical),
                "columns": len(self.canonical.columns),
                "teams": int(self.canonical.team_id.nunique()),
                "dtypes": {name: str(dtype) for name, dtype in self.canonical.dtypes.items()},
            },
            "focus": {
                "team_ids": list(config.team_ids),
                "rows": len(self.focus),
                "rows_by_team": self.focus.groupby("team_id").size().to_dict(),
            },
            "features": {
                "codes": list(config.metrics),
                "columns": list(self.features.columns),
                "rows": len(self.features),
            },
            "dictionary": [column.to_dict() for column in COLUMNS],
            "policies": {
                "missing": "Somente células vazias são ausências; preservadas sem imputação.",
                "rows": "Sem remoção de duplicatas, zeros ou outliers nesta etapa.",
                "dates": "Data civil ISO, sem conversão de fuso.",
                "sort": ["team_id", "game_date", "game_id"],
                "scope": "Todos os times da entrada preservados; recorte em tabela separada.",
            },
        }


def read_source(
    path: Path, *, expected_sha256: str | None = None
) -> tuple[pd.DataFrame, SourceMetadata]:
    """Lê um único snapshot dos bytes, preservando IDs e literais como 'NA'."""
    payload = path.read_bytes()
    digest = hashlib.sha256(payload).hexdigest()
    if expected_sha256 is not None and digest != expected_sha256:
        raise DatasetValidationError(
            f"SHA-256 divergente da proveniência: esperado {expected_sha256}, recebido {digest}."
        )
    try:
        text = payload.decode("utf-8-sig")
    except UnicodeDecodeError as error:
        raise DatasetValidationError("CSV deve usar codificação UTF-8.") from error

    try:
        reader = csv.reader(io.StringIO(text, newline=""), strict=True)
        header = next(reader, [])
        expected = [column.original for column in COLUMNS]
        duplicates = [name for name, count in Counter(header).items() if count > 1]
        missing = sorted(set(expected) - set(header))
        extra = sorted(set(header) - set(expected))
        if missing or extra or duplicates:
            raise DatasetValidationError(
                f"Schema CSV incompatível: faltantes={missing}, extras={extra}, "
                f"duplicadas={duplicates}."
            )
        records = []
        for index, row in enumerate(reader, start=1):
            if len(row) != len(header):
                raise DatasetValidationError(
                    f"Registro {index}: esperado {len(header)} campos, recebido {len(row)}."
                )
            records.append(row)
    except csv.Error as error:
        raise DatasetValidationError(f"CSV malformado: {error}.") from error

    frame = pd.DataFrame(records, columns=header, dtype=pd.StringDtype(storage="pyarrow"))
    metadata = SourceMetadata(path.name, digest, len(payload), len(frame), len(header))
    return frame.loc[:, expected], metadata


def _reject(column: ColumnSpec, invalid: pd.Series, rule: str) -> None:
    if invalid.fillna(False).any():
        records = [int(index) + 1 for index in invalid[invalid.fillna(False)].index[:5]]
        raise DatasetValidationError(
            f"Coluna {column.original}: {rule}; registros {records} (sem cabeçalho)."
        )


def _convert(series: pd.Series, column: ColumnSpec) -> pd.Series:
    # Não fazer strip ou converter literais NA/NULL em ausências silenciosamente.
    values = series.mask(series.eq(""), pd.NA)
    _reject(column, values.notna() & values.ne(values.str.strip()), "espaços externos")

    if column.kind == "identifier":
        _reject(column, ~values.str.fullmatch(r"[0-9]+", na=False), "ID deve conter dígitos")
        return values
    if column.kind == "string":
        return values
    if column.kind == "boolean":
        _reject(column, values.notna() & ~values.isin(["0", "1"]), "esperado 0 ou 1")
        return values.map({"0": False, "1": True}).astype("boolean")
    if column.kind == "date":
        _reject(
            column,
            values.notna() & ~values.str.fullmatch(r"[0-9]{4}-[0-9]{2}-[0-9]{2}", na=False),
            "esperado YYYY-MM-DD",
        )
        try:
            dates = pd.to_datetime(values, format="%Y-%m-%d", exact=True, errors="raise")
            return dates.dt.date.astype(pd.ArrowDtype(pa.date32()))
        except (ValueError, OverflowError) as error:
            raise DatasetValidationError(f"Coluna {column.original}: data inválida.") from error
    if column.kind == "integer":
        _reject(
            column,
            values.notna() & ~values.str.fullmatch(r"[0-9]+", na=False),
            "esperado inteiro não negativo",
        )
        try:
            return values.astype("Int64")
        except (ValueError, OverflowError) as error:
            raise DatasetValidationError(
                f"Coluna {column.original}: inteiro fora do intervalo Int64."
            ) from error

    try:
        numeric = pd.to_numeric(values, errors="raise").astype("Float64")
    except (ValueError, OverflowError) as error:
        raise DatasetValidationError(f"Coluna {column.original}: número inválido.") from error
    _reject(
        column,
        numeric.notna() & (~np.isfinite(numeric) | numeric.lt(0) | numeric.gt(1)),
        "esperada fração finita em [0,1]",
    )
    # Um literal 'NaN' não é célula vazia; não permiti-lo como missing criado no parsing.
    _reject(column, values.notna() & numeric.isna(), "literal numérico inválido")
    return numeric


def normalize_frame(raw: pd.DataFrame) -> pd.DataFrame:
    columns = {column.canonical: _convert(raw[column.original], column) for column in COLUMNS}
    return (
        pd.DataFrame(columns)
        .sort_values(["team_id", "game_date", "game_id"], kind="stable", na_position="last")
        .reset_index(drop=True)
    )


def select_focus(canonical: pd.DataFrame, config: Settings = settings) -> pd.DataFrame:
    missing = set(config.team_ids) - set(canonical.team_id)
    if missing:
        raise DatasetValidationError(f"Times principais ausentes da base: {sorted(missing)}.")
    return canonical.loc[canonical.team_id.isin(config.team_ids)].reset_index(drop=True).copy()


def select_features(focus: pd.DataFrame, config: Settings = settings) -> pd.DataFrame:
    """Retorna as sete features na ordem definida, sem IDs ou resultado como features."""
    return focus.loc[:, list(feature_columns(config.metrics))].copy()


def ingest(config: Settings = settings) -> IngestionResult:
    raw, source = read_source(config.dataset_path, expected_sha256=config.expected_dataset_sha256)
    canonical = normalize_frame(raw)
    focus = select_focus(canonical, config)
    return IngestionResult(source, canonical, focus, select_features(focus, config))
