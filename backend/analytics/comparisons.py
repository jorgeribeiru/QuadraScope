"""Resultados das sete variáveis e quadros comparativos sem recalcular fórmulas."""

import pandas as pd

from backend.analytics.descriptive import describe_team
from backend.analytics.distributions import compare_distributions
from backend.analytics.metrics import get_metric
from backend.app.config import Settings, settings


def descriptive_reports(focus: pd.DataFrame, config: Settings = settings) -> dict:
    results, distributions = [], []
    for metric in config.metrics:
        spec = get_metric(metric)
        results.extend(describe_team(focus, team, metric) for team in config.team_ids)
        groups = {
            team: focus.loc[focus.team_id.eq(team), spec.canonical].to_numpy()
            for team in config.team_ids
        }
        distributions.append({"metric": metric, **compare_distributions(groups, spec.unit)})
    lookup = {(item["metric"], item["team_id"]): item for item in results}
    matrices = {}
    for statistic in ("cv", "iqr"):
        rows = []
        for metric in config.metrics:
            cells = {
                team: {
                    **lookup[metric, team]["statistics"][statistic],
                    "n": lookup[metric, team]["n"],
                }
                for team in config.team_ids
            }
            rows.append(
                {
                    "metric": metric,
                    "unit": "%" if statistic == "cv" else get_metric(metric).unit,
                    "teams": cells,
                }
            )
        matrices[statistic] = {"team_ids": list(config.team_ids), "rows": rows}
    quartiles = [
        {
            "metric": item["metric"],
            "team_id": item["team_id"],
            "n": item["n"],
            **{key: item["statistics"][key] for key in ("q1", "q3", "iqr")},
        }
        for item in results
    ]
    summary = [
        {
            "metric": item["metric"],
            "team_id": item["team_id"],
            "n": item["n"],
            "statistics": item["statistics"],
        }
        for item in results
    ]
    return {
        "descriptives": {"results": results},
        "distributions": {"metrics": distributions},
        "comparisons": {"matrices": matrices, "quartiles": quartiles, "summary": summary},
    }
