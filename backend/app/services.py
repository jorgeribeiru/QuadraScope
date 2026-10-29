"""Composição HTTP independente de transporte; nenhuma fórmula científica duplicada."""

import pandas as pd

from backend.analytics.comparisons import descriptive_reports
from backend.analytics.descriptive import describe_team
from backend.analytics.distributions import compare_distributions
from backend.analytics.metrics import get_metric
from backend.app.config import Settings
from backend.app.queries import Filters
from backend.artifacts.serialization import canonical_bytes, digest
from backend.repositories.artifacts import ArtifactRepository


class AnalysisService:
    def __init__(self, repository: ArtifactRepository, config: Settings):
        self.repository, self.config = repository, config
        self.manifest = repository.manifest
        self._frame = pd.DataFrame(repository.get("games.json")["rows"])
        self._frame["game_date"] = pd.to_datetime(
            self._frame["game_date"], format="%Y-%m-%d"
        ).dt.date
        self.team_ids = set(self._frame.team_id)
        self._anomalies = repository.get("anomalies.json")["results"]

    def select(self, filters: Filters):
        frame = self._frame
        mask = frame.team_id.isin(self.config.team_ids)
        if filters.from_ is not None:
            mask &= frame.game_date.ge(filters.from_)
        if filters.to is not None:
            mask &= frame.game_date.le(filters.to)
        if filters.venue != "all":
            mask &= frame.venue.eq(filters.venue)
        if filters.outcome != "all":
            mask &= frame.won.eq(filters.outcome == "win")
        return frame.loc[mask]

    def context(self, endpoint, query, teams=None, metrics=None, scope="filtered_selection"):
        teams = list(self.config.team_ids) if teams is None else teams
        metrics = list(self.config.metrics) if metrics is None else metrics
        selected = self.select(query)
        counts, reference, periods = {}, {}, {}
        for team in teams:
            rows = selected.loc[selected.team_id.eq(team)]
            counts[team] = len(rows)
            reference[team] = int(self._frame.team_id.eq(team).sum())
            periods[team] = (
                {"from": rows.game_date.min().isoformat(), "to": rows.game_date.max().isoformat()}
                if len(rows)
                else None
            )
        warnings = []
        if not any(counts.values()):
            warnings.append(
                "Nenhuma observação atende à seleção; a infraestrutura está disponível."
            )
        elif any(n == 0 for n in counts.values()):
            warnings.append("Um dos times não tem observações na seleção.")
        if scope == "full_team_history_in_dataset":
            warnings.append(
                "Anomalias relativas ao histórico completo do próprio time; filtros alteram "
                "somente a exibição. Scores de times diferentes não formam ranking comum."
            )
        manifest = self.manifest
        identity = {
            "api_version": "1.0.0",
            "schema_version": manifest["schema_version"],
            "analysis_version": manifest["analysis_version"],
            "dataset_sha256": manifest["source"]["sha256"],
            "release_id": manifest["release_id"],
            "parameter_version": manifest["parameters"]["version"],
            "parameters": manifest["parameters"],
        }
        return {
            **identity,
            "team_ids": teams,
            "metrics": metrics,
            "filters": query.filters(),
            "reference_scope": scope,
            "n_by_team": counts,
            "reference_n_by_team": counts if scope == "filtered_selection" else reference,
            "period_by_team": periods,
            "status": "ok" if any(counts.values()) else "empty",
            "warnings": warnings,
            "cache_key": digest(
                canonical_bytes(
                    {
                        **identity,
                        "endpoint": endpoint,
                        "query": query.model_dump(mode="json", by_alias=True),
                        "team_ids": teams,
                        "metrics": metrics,
                        "scope": scope,
                    }
                )
            ),
        }

    def teams(self):
        rows = []
        for team, frame in self._frame.groupby("team_id", sort=True):
            rows.append(
                {
                    "team_id": team,
                    "name": str(frame.iloc[0].team_name),
                    "abbreviation": str(frame.iloc[0].matchup).split()[0],
                    "role": "primary" if team in self.config.team_ids else "context",
                    "n": len(frame),
                    "period": {"from": frame.game_date.min(), "to": frame.game_date.max()},
                }
            )
        return rows

    def summary(self, team, query):
        frame = self.select(query)
        return {"results": [describe_team(frame, team, metric) for metric in self.config.metrics]}

    def distributions(self, query):
        frame = self.select(query)
        spec = get_metric(query.metric)
        groups = {
            team: frame.loc[frame.team_id.eq(team), spec.canonical].to_numpy()
            for team in self.config.team_ids
        }
        distribution = {"metric": query.metric, **compare_distributions(groups, spec.unit)}
        distribution["teams"] = [t for t in distribution["teams"] if t["team_id"] == query.team_id]
        return {
            "distribution": distribution,
            "description": describe_team(frame, query.team_id, query.metric),
        }

    def comparisons(self, query):
        report = descriptive_reports(self.select(query), self.config)["comparisons"]
        return {
            **report,
            "selected_metric": query.metric,
            "selected_summary": [r for r in report["summary"] if r["metric"] == query.metric],
        }

    def anomalies(self, query):
        # Cópia profunda: filtros nunca modificam o relatório carregado para outras consultas.
        from copy import deepcopy

        result = deepcopy(
            next(
                r
                for r in self._anomalies
                if r["team_id"] == query.team_id
                and r["method"] == query.method
                and r["metric"] == query.metric
            )
        )
        ids = set(self.select(query).loc[lambda frame: frame.team_id.eq(query.team_id), "game_id"])
        result["records"] = [r for r in result["records"] if r["game_id"] in ids]
        result["display_n"] = len(result["records"])
        flags = [r["is_outlier"] for r in result["records"]]
        count = sum(flags) if all(flag is not None for flag in flags) else None
        if result["outlier_count"] is None:
            count = None
        return {"result": result, "display_outlier_count": count}
