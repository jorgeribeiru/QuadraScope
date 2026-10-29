"""Allowlist de consultas e combinações científicas admitidas pelo MVP."""

import re
from datetime import date
from typing import Literal

from pydantic import BaseModel, ConfigDict, Field, field_validator, model_validator

from backend.app.config import settings
from backend.artifacts.models import Method, Metric

CANONICAL_FEATURES = ",".join(settings.metrics)
CANONICAL_TEAMS = ",".join(settings.team_ids)


class NoQuery(BaseModel):
    model_config = ConfigDict(extra="forbid")


class Filters(NoQuery):
    from_: date | None = Field(default=None, alias="from")
    to: date | None = None
    venue: Literal["all", "home", "away"] = "all"
    outcome: Literal["all", "win", "loss"] = "all"

    @field_validator("from_", "to", mode="before")
    @classmethod
    def civil_date(cls, value):
        if isinstance(value, str) and not re.fullmatch(r"\d{4}-\d{2}-\d{2}", value):
            raise ValueError("Usar data civil YYYY-MM-DD.")
        return value

    @model_validator(mode="after")
    def ordered_dates(self):
        if self.from_ and self.to and self.from_ > self.to:
            raise ValueError("from deve ser anterior ou igual a to.")
        return self

    def filters(self):
        return self.model_dump(
            mode="json", by_alias=True, include={"from_", "to", "venue", "outcome"}
        )


class DistributionQuery(Filters):
    team_id: str = Field(pattern=r"^[0-9]+$")
    metric: Metric


class ComparisonQuery(Filters):
    team_ids: str = CANONICAL_TEAMS
    metric: Metric = "PTS"

    @field_validator("team_ids")
    @classmethod
    def complete_pair(cls, value):
        ids = value.split(",")
        if len(ids) != 2 or set(ids) != set(settings.team_ids):
            raise ValueError("Comparar exatamente Atlanta Hawks e Houston Rockets, sem duplicatas.")
        return CANONICAL_TEAMS


class AnomalyQuery(Filters):
    team_id: str = Field(pattern=r"^[0-9]+$")
    method: Method
    metric: Metric | None = None
    features: str | None = None

    @model_validator(mode="after")
    def method_features(self):
        if self.method in {"zscore", "iqr", "grubbs"}:
            if self.metric is None or self.features is not None:
                raise ValueError("Método univariado exige metric e não aceita features.")
        else:
            if self.metric is not None or self.features not in {None, CANONICAL_FEATURES}:
                raise ValueError("Método multivariado aceita apenas as sete features canônicas.")
            self.features = CANONICAL_FEATURES
        return self


class InterpretationQuery(Filters):
    context: Literal["overview", "teams", "comparisons", "anomalies", "quality", "methodology"]
    team_id: str | None = Field(default=None, pattern=r"^[0-9]+$")
    metric: Metric | None = None
