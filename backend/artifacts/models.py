"""Contrato 1.0.0: tipos fechados, números finitos e linhas sem coerção silenciosa."""

from datetime import date
from typing import Annotated, Literal

from pydantic import (
    AwareDatetime,
    BaseModel,
    ConfigDict,
    Field,
    FiniteFloat,
    JsonValue,
    create_model,
)

from backend.analytics.metrics import COLUMNS

SCHEMA_VERSION = "1.0.0"
Hash = Annotated[str, Field(pattern=r"^[0-9a-f]{64}$")]
Identifier = Annotated[str, Field(pattern=r"^[0-9]+$")]
Count = Annotated[int, Field(ge=0)]
Positive = Annotated[FiniteFloat, Field(gt=0)]
Fraction = Annotated[FiniteFloat, Field(ge=0, le=1)]
Metric = Literal["PTS", "REB", "AST", "STL", "BLK", "PF", "FG3M"]
Method = Literal["zscore", "iqr", "grubbs", "ecod", "knn", "lof", "dbscan"]
State = Literal["ok", "empty", "insufficient_sample", "constant_series", "not_applicable"]
JSONMap = dict[str, JsonValue]


class Contract(BaseModel):
    model_config = ConfigDict(extra="forbid", strict=True, allow_inf_nan=False)


ROW_TYPES = {
    "identifier": Identifier,
    "string": Annotated[str, Field(min_length=1)],
    "integer": Count,
    "float": Fraction,
    "boolean": bool,
    "date": date,
}
CanonicalRow = create_model(
    "CanonicalRow", __base__=Contract, **{c.canonical: (ROW_TYPES[c.kind], ...) for c in COLUMNS}
)
GameRow = create_model(
    "GameRow",
    __base__=CanonicalRow,
    opponent_id=(Identifier, ...),
    opponent_points=(Count, ...),
    point_margin=(int, ...),
    venue=(Literal["home", "away"], ...),
    overtime_periods=(Count, ...),
)


class Source(Contract):
    filename: str
    sha256: Hash
    size_bytes: Count
    row_count: Count
    column_count: Count
    encoding: str
    delimiter: str


class Metadata(Contract):
    schema_version: Literal["1.0.0"]
    analysis_version: str
    source: Source
    team_ids: list[Identifier]
    metric_codes: list[Metric]
    parameter_version: str
    parameters: JSONMap
    dependencies: dict[str, str]


class Envelope(Contract):
    metadata: Metadata


class Period(Contract):
    from_: date = Field(alias="from")
    to: date


class Measure(Contract):
    value: FiniteFloat | list[FiniteFloat] | None
    status: State
    reason: str | None
    unit: str
    method: str
    parameters: JSONMap
    frequency: Count | None = None


class Statistics(Contract):
    mean: Measure
    median: Measure
    modes: Measure
    minimum: Measure
    maximum: Measure
    range: Measure
    variance: Measure
    std: Measure
    q1: Measure
    q3: Measure
    iqr: Measure
    cv: Measure
    iqr_median_ratio: Measure
    skewness: Measure


class IQR(Contract):
    n: Count
    method: Literal["linear"]
    k: Positive
    q1: FiniteFloat | None
    median: FiniteFloat | None
    q3: FiniteFloat | None
    iqr: FiniteFloat | None
    lower_fence: FiniteFloat | None
    upper_fence: FiniteFloat | None


class BoxOutlier(Contract):
    team_id: Identifier
    game_id: Identifier
    game_date: date
    matchup: str
    value: FiniteFloat
    side: Literal["lower", "upper"]


class Boxplot(IQR):
    status: State
    unit: str
    mean: FiniteFloat | None
    modes: list[FiniteFloat]
    mode_frequency: Count
    lower_whisker: FiniteFloat | None
    upper_whisker: FiniteFloat | None
    outliers: list[BoxOutlier]
    outlier_count: Count


class SkewClassification(Contract):
    direction: Literal["right", "left", "neutral"]
    intensity: Literal["approximately_symmetric", "moderate", "strong"]
    criteria: dict[str, str]


class Description(Contract):
    n: Count
    statistics: Statistics
    iqr_limits: IQR
    skewness_classification: SkewClassification | None
    warnings: list[str]
    team_id: Identifier
    metric: Metric
    unit: str
    period: Period | None
    boxplot: Boxplot


class Histogram(Contract):
    status: State
    n: Count
    counts: list[Count]
    density: list[Annotated[FiniteFloat, Field(ge=0)]]
    edges: list[FiniteFloat]
    unit: str
    interval_policy: str


class KDE(Contract):
    status: State
    reason: str | None
    x: list[FiniteFloat]
    density: list[Annotated[FiniteFloat, Field(ge=0)]]
    bandwidth_factor: Positive | None
    bandwidth: Positive | None
    probability_in_grid: Fraction | None
    n: Count
    method: Literal["scipy.stats.gaussian_kde"]
    bw_method: Literal["scott"]
    unit: str
    warnings: list[str]


class DistributionTeam(Contract):
    team_id: Identifier
    n: Count
    histogram: Histogram
    kde: KDE


class Distribution(Contract):
    metric: Metric
    unit: str
    reference_team_ids: list[Identifier]
    pooled_n: Count
    bin_parameters: JSONMap
    grid_parameters: JSONMap
    teams: list[DistributionTeam]


class Cell(Measure):
    n: Count


class MatrixRow(Contract):
    metric: Metric
    unit: str
    teams: dict[Identifier, Cell]


class Matrix(Contract):
    team_ids: list[Identifier]
    rows: list[MatrixRow]


class QuartilesRow(Contract):
    metric: Metric
    team_id: Identifier
    n: Count
    q1: Measure
    q3: Measure
    iqr: Measure


class SummaryRow(Contract):
    metric: Metric
    team_id: Identifier
    n: Count
    statistics: Statistics


class QualityCheck(Contract):
    rule: str
    severity: Literal["blocker", "warning"]
    status: Literal["pass", "fail", "not_evaluated", "observed"]
    description: str | None = None
    affected_records: Count | None = None
    examples: list[dict[str, Identifier]] | None = None
    missing: Count | None = None
    outside_domain: Count | None = None
    count: Count | None = None
    unit: str | None = None


class OutlierAvailability(Contract):
    status: Literal["not_evaluated", "not_applicable"]
    count: None
    reason: str


class ColumnQuality(Contract):
    original: str
    canonical: str
    n: Count
    missing: Count
    zeros: Count | None
    negatives: Count | None
    outside_domain: Count
    domain: str
    special_value_policy: str
    outliers: OutlierAvailability


class Quality(Contract):
    status: Literal["passed"]
    failed_rules: list[str]
    checks: list[QualityCheck]
    columns: list[ColumnQuality]
    focus_columns: list[ColumnQuality]
    duplicates: dict[str, Count]
    missingness: JSONMap
    coverage: JSONMap
    parameters: JSONMap


class Reference(Contract):
    team_id: Identifier
    n: Count
    scope: Literal["full_team_history_in_dataset"]
    period: Period | None


class TailProbability(Contract):
    left: Fraction
    right: Fraction


class AnomalyRecord(Contract):
    team_id: Identifier
    game_id: Identifier
    game_date: date
    matchup: str
    values: dict[Metric, FiniteFloat]
    score: FiniteFloat | None
    raw_score: FiniteFloat | None
    is_outlier: bool | None
    is_candidate: bool | None = None
    neighbor_game_ids: list[Identifier] | None = None
    library_label: Literal[-1, 1] | None = None
    feature_contributions: dict[Metric, FiniteFloat] | None = None
    tail_probabilities: dict[Metric, TailProbability] | None = None
    cluster: int | None = None


class GrubbsTest(Contract):
    statistic: FiniteFloat
    critical_value: FiniteFloat
    rejected: bool
    candidate_game_ids: list[Identifier]
    attribution: Literal["single_candidate", "ambiguous_tie"]


class Anomaly(Contract):
    method: Method
    unit: str | None
    feature_units: dict[Metric, str]
    score_unit: str | None
    team_id: Identifier
    metric: Metric | None
    features: list[Metric]
    status: State
    reason: str | None
    reference_n: Count
    display_n: Count
    reference: Reference
    parameters: JSONMap
    threshold: FiniteFloat | dict[str, FiniteFloat | None] | None
    score_direction: Literal["higher_is_more_atypical", "not_applicable"]
    outlier_count: Count | None
    records: list[AnomalyRecord]
    warnings: list[str]
    quartiles: IQR | None = None
    test: GrubbsTest | None = None
    clusters: Count | None = None


class AnomalySummary(Contract):
    team_id: Identifier
    metric: Metric | None
    features: list[Metric]
    method: Method
    status: State
    reference_n: Count
    outlier_count: Count | None


class DictionaryColumn(Contract):
    original: str
    canonical: str
    label: str
    kind: Literal["identifier", "string", "integer", "float", "boolean", "date"]
    unit: str
    role: Literal["context", "auxiliary", "primary"]
    domain: str
    analysis_eligible: bool
    exclusion_reason: str | None


class GamesArtifact(Envelope):
    kind: Literal["games"]
    rows: list[GameRow]


class DescriptivesArtifact(Envelope):
    kind: Literal["descriptives"]
    results: list[Description]


class DistributionsArtifact(Envelope):
    kind: Literal["distributions"]
    metrics: list[Distribution]


class ComparisonsArtifact(Envelope):
    kind: Literal["comparisons"]
    matrices: dict[Literal["cv", "iqr"], Matrix]
    quartiles: list[QuartilesRow]
    summary: list[SummaryRow]


class QualityArtifact(Envelope):
    kind: Literal["quality"]
    report: Quality


class AnomaliesArtifact(Envelope):
    kind: Literal["anomalies"]
    results: list[Anomaly]
    summary: list[AnomalySummary]


class SensitivityArtifact(Envelope):
    kind: Literal["sensitivity"]
    grids: JSONMap
    teams: list[JSONMap]
    selection: JSONMap
    limitations: list[str]


class DictionaryArtifact(Envelope):
    kind: Literal["dictionary"]
    columns: list[DictionaryColumn]


class ContentArtifact(Envelope):
    kind: Literal["content"]
    provenance: JSONMap
    methodology: JSONMap
    missingness: JSONMap
    interpretation_status: Literal["pending_stage_9"]
    interpretations: list[JSONMap]
    licenses: dict[str, str]


class SchemasArtifact(Envelope):
    kind: Literal["schemas"]
    models: dict[str, JSONMap]


class CodeIdentity(Contract):
    git_commit: str | None
    git_dirty: bool | None
    source_tree_sha256: Hash
    files: dict[str, Hash]


class ArtifactEntry(Contract):
    sha256: Hash
    size_bytes: Count
    format: Literal["json", "parquet"]
    schema_name: str
    runtime: bool


class Manifest(Contract):
    manifest_version: Literal["1.0.0"]
    schema_version: Literal["1.0.0"]
    analysis_version: str
    release_id: Hash
    generated_at: AwareDatetime
    source: Source
    code: CodeIdentity
    dependencies: dict[str, str]
    environment: dict[str, str]
    parameters: JSONMap
    feature_order: list[Metric]
    team_ids: list[Identifier]
    artifacts: dict[str, ArtifactEntry]
    runtime_policy: JSONMap


class CurrentPointer(Contract):
    schema_version: Literal["1.0.0"]
    release_id: Hash
    manifest_sha256: Hash


ARTIFACT_MODELS = {
    "games.json": GamesArtifact,
    "descriptives.json": DescriptivesArtifact,
    "distributions.json": DistributionsArtifact,
    "comparisons.json": ComparisonsArtifact,
    "quality.json": QualityArtifact,
    "anomalies.json": AnomaliesArtifact,
    "sensitivity.json": SensitivityArtifact,
    "dictionary.json": DictionaryArtifact,
    "content.json": ContentArtifact,
    "schemas.json": SchemasArtifact,
}
PARQUET_MODELS = {
    "canonical.parquet": CanonicalRow,
    "games.parquet": GameRow,
    "focus.parquet": GameRow,
}
