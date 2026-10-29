"""Formato físico Parquet: dependência somente do pipeline."""

import pyarrow as pa

from backend.analytics.metrics import COLUMNS


def parquet_schema(enriched=False):
    types = {
        "identifier": pa.string(),
        "string": pa.string(),
        "integer": pa.int64(),
        "float": pa.float64(),
        "boolean": pa.bool_(),
        "date": pa.date32(),
    }
    fields = [pa.field(c.canonical, types[c.kind], nullable=False) for c in COLUMNS]
    if enriched:
        fields += [
            pa.field("opponent_id", pa.string(), nullable=False),
            pa.field("opponent_points", pa.int64(), nullable=False),
            pa.field("point_margin", pa.int64(), nullable=False),
            pa.field("venue", pa.string(), nullable=False),
            pa.field("overtime_periods", pa.int64(), nullable=False),
        ]
    return pa.schema(fields)
