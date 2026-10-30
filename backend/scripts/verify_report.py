"""Auditoria independente CSV → artefatos, sem usar as funções científicas de produção."""

import argparse
import csv
import hashlib
import json
import math
import statistics
from collections import Counter
from datetime import UTC, datetime
from pathlib import Path

from backend.app.config import settings
from backend.repositories.artifacts import ArtifactRepository

METRICS = ("PTS", "REB", "AST", "STL", "BLK", "PF", "FG3M")
UNITS = {
    "PTS": "pontos/jogo",
    "REB": "rebotes/jogo",
    "AST": "assistências/jogo",
    "STL": "roubos/jogo",
    "BLK": "tocos/jogo",
    "PF": "faltas/jogo",
    "FG3M": "cestas/jogo",
}


def quantile(values, fraction):
    ordered = sorted(values)
    position = (len(ordered) - 1) * fraction
    low, high = math.floor(position), math.ceil(position)
    return ordered[low] + (ordered[high] - ordered[low]) * (position - low)


def same(actual, expected, label):
    if expected is None:
        assert actual is None, label
    elif isinstance(expected, list):
        assert actual == expected, label
    else:
        assert math.isclose(actual, expected, rel_tol=1e-10, abs_tol=1e-10), (
            label,
            actual,
            expected,
        )


def audit():
    repository = ArtifactRepository()
    raw = settings.dataset_path.read_bytes()
    assert hashlib.sha256(raw).hexdigest() == repository.manifest["source"]["sha256"]
    with settings.dataset_path.open(encoding="utf-8-sig", newline="") as source:
        rows = list(csv.DictReader(source))
    originals = {(r["Team_ID"], r["Game_ID"]): r for r in rows}
    descriptions = repository.get("descriptives.json")["results"]
    anomalies = repository.get("anomalies.json")["results"]
    comparison = repository.get("comparisons.json")
    readings = repository.get("content.json")["interpretations"]
    pairs, flagged, candidates, record_count = [], [], [], 0
    for description in descriptions:
        team, metric = description["team_id"], description["metric"]
        own = [r for r in rows if r["Team_ID"] == team]
        values = [float(r[metric]) for r in own]
        n, mean, std = len(values), statistics.mean(values), statistics.stdev(values)
        q1, median, q3 = (quantile(values, q) for q in (0.25, 0.5, 0.75))
        frequencies = Counter(values)
        frequency = max(frequencies.values())
        modes = (
            sorted(v for v, count in frequencies.items() if count == frequency)
            if frequency > 1
            else []
        )
        iqr = q3 - q1
        expected = {
            "mean": mean,
            "median": median,
            "std": std,
            "variance": statistics.variance(values),
            "minimum": min(values),
            "maximum": max(values),
            "range": max(values) - min(values),
            "modes": modes,
            "q1": q1,
            "q3": q3,
            "iqr": iqr,
            "cv": 100 * std / mean,
            "iqr_median_ratio": iqr / median if median > 0 else None,
            "skewness": n / ((n - 1) * (n - 2)) * sum(((v - mean) / std) ** 3 for v in values),
        }
        assert description["n"] == n
        assert description["unit"] == UNITS[metric]
        assert description["period"] == {
            "from": min(r["GAME_DATE"] for r in own),
            "to": max(r["GAME_DATE"] for r in own),
        }
        for key, value in expected.items():
            same(description["statistics"][key]["value"], value, f"{team}/{metric}/{key}")
            expected_unit = (
                "%"
                if key == "cv"
                else "fração"
                if key == "iqr_median_ratio"
                else "adimensional"
                if key == "skewness"
                else f"({UNITS[metric]})²"
                if key == "variance"
                else UNITS[metric]
            )
            assert description["statistics"][key]["unit"] == expected_unit
        assert description["statistics"]["modes"]["frequency"] == frequency
        lower, upper = q1 - 1.5 * iqr, q3 + 1.5 * iqr
        box = description["boxplot"]
        same(box["lower_fence"], lower, "cerca inferior")
        same(box["upper_fence"], upper, "cerca superior")
        same(box["lower_whisker"], min(v for v in values if lower <= v <= upper), "bigode inferior")
        same(box["upper_whisker"], max(v for v in values if lower <= v <= upper), "bigode superior")
        same(box["mean"], mean, "média no gráfico")
        assert box["modes"] == modes
        expected_outliers = {
            r["Game_ID"] for r in own if float(r[metric]) < lower or float(r[metric]) > upper
        }
        assert {r["game_id"] for r in box["outliers"]} == expected_outliers
        assert box["outlier_count"] == len(expected_outliers)
        for outlier in box["outliers"]:
            original = originals[team, outlier["game_id"]]
            assert outlier["game_date"] == original["GAME_DATE"]
            assert outlier["matchup"] == original["MATCHUP"]
            assert outlier["value"] == float(original[metric])
            assert outlier["side"] == ("lower" if outlier["value"] < lower else "upper")
        for kind in ("cv", "iqr"):
            cell = next(r for r in comparison["matrices"][kind]["rows"] if r["metric"] == metric)[
                "teams"
            ][team]
            same(cell["value"], expected[kind], f"matriz {kind}")
            assert cell["n"] == n
        quartiles = next(
            r for r in comparison["quartiles"] if r["team_id"] == team and r["metric"] == metric
        )
        for key in ("q1", "q3", "iqr"):
            same(quartiles[key]["value"], expected[key], "quadro de quartis")
        reading = next(r for r in readings if r["team_id"] == team and r["metric"] == metric)
        assert reading["n"] == n
        for key, value in reading["evidence"].items():
            same(value, expected[key], "evidência da interpretação")
        diagnostic = reading.get("sensitivity_diagnostic")
        if expected_outliers:
            assert diagnostic is not None
            retained = [float(r[metric]) for r in own if r["Game_ID"] not in expected_outliers]
            assert diagnostic["excluded_game_ids"] == sorted(expected_outliers)
            assert diagnostic["retained_n"] == len(retained)
            same(diagnostic["retained_std"], statistics.stdev(retained), "desvio diagnóstico")
            same(
                diagnostic["retained_iqr"],
                quantile(retained, 0.75) - quantile(retained, 0.25),
                "IQR diagnóstico",
            )
        distribution = next(
            r for r in repository.get("distributions.json")["metrics"] if r["metric"] == metric
        )
        histogram = next(r for r in distribution["teams"] if r["team_id"] == team)["histogram"]
        edges = histogram["edges"]
        counts = [
            sum(a <= v and (v < b or (i == len(edges) - 2 and v == b)) for v in values)
            for i, (a, b) in enumerate(zip(edges, edges[1:], strict=False))
        ]
        assert counts == histogram["counts"] and sum(counts) == n
        for i, count in enumerate(counts):
            same(histogram["density"][i], count / (n * (edges[i + 1] - edges[i])), "densidade")
        pairs.append(
            {
                "team_id": team,
                "metric": metric,
                "unit": UNITS[metric],
                "n": n,
                "statistics": expected,
                "lower_fence": lower,
                "upper_fence": upper,
                "boxplot_outlier_ids": sorted(expected_outliers),
                "sensitivity_diagnostic": diagnostic,
                "modes": modes,
            }
        )
    for result in anomalies:
        team, metric, method = result["team_id"], result["metric"], result["method"]
        own = [r for r in rows if r["Team_ID"] == team]
        assert result["reference_n"] == len(own) == len(result["records"])
        scores = [r["score"] for r in result["records"]]
        if method in {"ecod", "knn", "lof"}:
            same(result["threshold"], quantile(scores, 0.95), "corte relativo do score")
        values = [float(r[metric]) for r in own] if metric else []
        for record in result["records"]:
            record_count += 1
            original = originals[team, record["game_id"]]
            assert (
                record["game_date"] == original["GAME_DATE"]
                and record["matchup"] == original["MATCHUP"]
            )
            for feature, value in record["values"].items():
                same(value, float(original[feature]), "vetor original da partida")
            if method in {"zscore", "grubbs"}:
                score = abs(
                    (float(original[metric]) - statistics.mean(values)) / statistics.stdev(values)
                )
                same(record["score"], score, "score univariado independente")
            if method == "iqr":
                pair = next(p for p in pairs if p["team_id"] == team and p["metric"] == metric)
                assert record["is_outlier"] == (record["game_id"] in pair["boxplot_outlier_ids"])
            elif method == "dbscan":
                assert record["is_outlier"] == (record["cluster"] == -1)
            elif method != "grubbs":
                assert record["is_outlier"] == (record["score"] > result["threshold"])
            else:
                candidate = math.isclose(
                    record["score"], result["test"]["statistic"], rel_tol=1e-12
                )
                assert record["is_candidate"] == candidate
                expected_flag = (
                    None
                    if candidate
                    and result["test"]["rejected"]
                    and result["test"]["attribution"] == "ambiguous_tie"
                    else bool(candidate and result["test"]["rejected"])
                )
                assert record["is_outlier"] == expected_flag
            entry = {"team_id": team, "method": method, "metric": metric, **record}
            if record["is_outlier"]:
                flagged.append(entry)
            if record.get("is_candidate"):
                candidates.append(entry)
        decisions = [r["is_outlier"] for r in result["records"]]
        expected_count = sum(decisions) if all(flag is not None for flag in decisions) else None
        assert result["outlier_count"] == expected_count
    return {
        "status": "passed",
        "generated_at": datetime.now(UTC).isoformat(),
        "source_sha256": hashlib.sha256(raw).hexdigest(),
        "review_script_sha256": hashlib.sha256(Path(__file__).read_bytes()).hexdigest(),
        "release_id": repository.manifest["release_id"],
        "method": "csv.DictReader + statistics + independent linear quantiles and skew formula",
        "pair_count": len(pairs),
        "anomaly_analyses": len(anomalies),
        "detector_records_checked": record_count,
        "boxplot_occurrences": sum(len(p["boxplot_outlier_ids"]) for p in pairs),
        "flagged_occurrences": len(flagged),
        "pairs": pairs,
        "flagged_records": flagged,
        "grubbs_candidates": candidates,
        "limits": [
            "Decisões sobre scores multivariados são conferidas; "
            "não se afirma reimplementação independente dos quatro estimadores.",
            "Validação visual e de transporte HTTP é registrada "
            "separadamente nos testes do navegador.",
        ],
    }


if __name__ == "__main__":
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument(
        "--output", type=Path, default=settings.processed_data_dir / "stage10-scientific.json"
    )
    args = parser.parse_args()
    report = audit()
    args.output.parent.mkdir(parents=True, exist_ok=True)
    args.output.write_text(json.dumps(report, ensure_ascii=False, indent=2) + "\n")
    print(
        json.dumps(
            {
                key: report[key]
                for key in [
                    "status",
                    "pair_count",
                    "anomaly_analyses",
                    "detector_records_checked",
                    "boxplot_occurrences",
                    "flagged_occurrences",
                ]
            }
        )
    )
