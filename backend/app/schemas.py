"""Contratos HTTP 1.0.0; os resultados científicos reutilizam os modelos do build."""

from datetime import date
from typing import Literal

from pydantic import Field

from backend.artifacts.models import (
    Anomaly,
    AnomalySummary,
    Contract,
    Count,
    Description,
    DictionaryColumn,
    Distribution,
    Hash,
    Identifier,
    JSONMap,
    Matrix,
    Metric,
    Period,
    Quality,
    QuartilesRow,
    Source,
    SummaryRow,
)


class Selection(Contract):
    from_: date | None = Field(alias="from")
    to: date | None
    venue: Literal["all", "home", "away"]
    outcome: Literal["all", "win", "loss"]


class Context(Contract):
    api_version: Literal["1.0.0"]
    schema_version: Literal["1.0.0"]
    analysis_version: str
    dataset_sha256: Hash
    release_id: Hash
    parameter_version: str
    parameters: JSONMap
    team_ids: list[Identifier]
    metrics: list[Metric]
    filters: Selection
    reference_scope: Literal["filtered_selection", "full_team_history_in_dataset", "full_dataset"]
    n_by_team: dict[Identifier, Count]
    reference_n_by_team: dict[Identifier, Count]
    period_by_team: dict[Identifier, Period | None]
    status: Literal["ok", "empty"]
    warnings: list[str]
    cache_key: Hash


class Response(Contract):
    context: Context


class HealthResponse(Contract):
    status: Literal["ready"]
    api_version: Literal["1.0.0"]
    schema_version: Literal["1.0.0"]
    analysis_version: str
    release_id: Hash
    dataset_sha256: Hash


class MetaResponse(Response):
    source: Source
    metrics: list[DictionaryColumn]
    coverage: JSONMap
    runtime_policy: JSONMap


class DictionaryResponse(Response):
    columns: list[DictionaryColumn]


class Team(Contract):
    team_id: Identifier
    name: str
    abbreviation: str
    role: Literal["primary", "context"]
    n: Count
    period: Period


class TeamsResponse(Response):
    teams: list[Team]


class SummaryResponse(Response):
    results: list[Description]


class DistributionResponse(Response):
    distribution: Distribution
    description: Description


class ComparisonResponse(Response):
    selected_metric: Metric
    selected_summary: list[SummaryRow]
    matrices: dict[Literal["cv", "iqr"], Matrix]
    quartiles: list[QuartilesRow]
    summary: list[SummaryRow]


class AnomalyResponse(Response):
    result: Anomaly
    display_outlier_count: Count | None


class QualityResponse(Response):
    report: Quality
    anomaly_summary: list[AnomalySummary]


class InterpretationResponse(Response):
    requested_context: str
    interpretation_status: Literal["descriptive_available"]
    reason: str
    interpretations: list[JSONMap]
    provenance: JSONMap
    methodology: JSONMap
    missingness: JSONMap


class ErrorDetail(Contract):
    location: list[str | int]
    message: str
    type: str


class Error(Contract):
    code: str
    message: str
    details: list[ErrorDetail]


class ErrorResponse(Contract):
    error: Error
