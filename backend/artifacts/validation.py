"""Integridade, schemas e invariantes entre arquivos; modo runtime não importa PyArrow."""

import math
from bisect import bisect_right
from collections import defaultdict
from pathlib import Path

from backend.analytics.metrics import COLUMNS, get_metric
from backend.app.config import Settings, settings
from backend.artifacts.models import (
    ARTIFACT_MODELS,
    PARQUET_MODELS,
    SCHEMA_VERSION,
    Manifest,
)
from backend.artifacts.serialization import (
    ArtifactError,
    canonical_bytes,
    digest,
    read_json,
    validate_model,
)


def require(condition, message):
    if not condition:
        raise ArtifactError(message)


def close(left, right):
    return (
        left is not None
        and right is not None
        and math.isclose(left, right, rel_tol=1e-10, abs_tol=1e-10)
    )


def release_identity(manifest: dict) -> str:
    return digest(
        canonical_bytes(
            {k: v for k, v in manifest.items() if k not in {"release_id", "generated_at"}}
        )
    )


def schema_models() -> dict:
    from backend.artifacts.models import CurrentPointer

    models = {
        model.__name__: model
        for model in [*ARTIFACT_MODELS.values(), *PARQUET_MODELS.values(), Manifest, CurrentPointer]
    }
    return {name: model.model_json_schema(by_alias=True) for name, model in models.items()}


def _expected_pairs(config):
    return {(team, metric) for team in config.team_ids for metric in config.metrics}


def _index(rows, keys):
    result = {tuple(row[key] for key in keys): row for row in rows}
    require(len(result) == len(rows), f"Chaves duplicadas no contrato: {keys}.")
    return result


def validate_relationships(documents: dict, manifest: dict, config: Settings = settings):
    metadata = documents["games.json"]["metadata"]
    for name, document in documents.items():
        require(document["metadata"] == metadata, f"Metadados divergentes: {name}.")
    require(metadata["source"] == manifest["source"], "Fonte dos artefatos difere do manifesto.")
    require(metadata["parameters"] == manifest["parameters"], "Parâmetros diferem do manifesto.")
    require(metadata["dependencies"] == manifest["dependencies"], "Dependências divergentes.")
    require(
        metadata["analysis_version"] == manifest["analysis_version"],
        "Versão de análise divergente.",
    )
    require(
        metadata["metric_codes"] == manifest["feature_order"] == list(config.metrics),
        "Ordem de features divergente.",
    )
    require(
        metadata["team_ids"] == manifest["team_ids"] == list(config.team_ids),
        "Times principais divergentes.",
    )
    require(
        documents["schemas.json"]["models"] == schema_models(),
        "JSON Schemas incompatíveis com o código leitor.",
    )
    require(
        documents["dictionary.json"]["columns"] == [c.to_dict() for c in COLUMNS],
        "Dicionário difere do registro de métricas.",
    )

    games = documents["games.json"]["rows"]
    require(len(games) == metadata["source"]["row_count"] > 0, "Cobertura de linhas divergente.")
    require(
        metadata["source"]["column_count"] == len(COLUMNS),
        "Número de colunas de origem divergente.",
    )
    index = _index(games, ["team_id", "game_id"])
    by_team, by_game = defaultdict(list), defaultdict(list)
    for row in games:
        by_team[row["team_id"]].append(row)
        by_game[row["game_id"]].append(row)
        other = index.get((row["opponent_id"], row["game_id"]))
        require(
            other is not None and other["team_id"] != row["team_id"], "Adversário ausente/inválido."
        )
        require(row["opponent_points"] == other["points"], "Pontos do adversário inconsistentes.")
        require(row["point_margin"] == row["points"] - other["points"], "Saldo inconsistente.")
        require(
            row["game_date"] == other["game_date"] and row["venue"] != other["venue"],
            "Data ou mando inconsistentes.",
        )
        require(
            row["won"] == (row["points"] > other["points"]) and row["won"] != other["won"],
            "Resultado inconsistente.",
        )
        require(
            row["team_minutes"] == 240 + 25 * row["overtime_periods"] == other["team_minutes"],
            "Prorrogação inconsistente.",
        )
    require(all(len(rows) == 2 for rows in by_game.values()), "Partida sem exatamente dois times.")
    require(set(config.team_ids) <= set(by_team), "Time principal ausente.")

    quality = documents["quality.json"]["report"]
    require(not quality["failed_rules"], "Qualidade contém falhas bloqueantes.")
    require(
        all(c["status"] == "pass" for c in quality["checks"] if c["severity"] == "blocker"),
        "Regra bloqueante não aprovada.",
    )
    for key, n in (
        ("columns", len(games)),
        ("focus_columns", sum(len(by_team[t]) for t in config.team_ids)),
    ):
        profiles = quality[key]
        require(
            len(profiles) == len(COLUMNS)
            and {p["original"] for p in profiles} == {c.original for c in COLUMNS},
            "Perfil de colunas incompleto.",
        )
        require(
            all(p["n"] == n and p["missing"] == p["outside_domain"] == 0 for p in profiles),
            "Perfil de qualidade incoerente.",
        )
    coverage = quality["coverage"]
    require(
        coverage["rows"] == len(games)
        and coverage["unique_games"] == len(by_game)
        and coverage["teams"] == len(by_team),
        "Cobertura global inconsistente.",
    )
    require(
        coverage["focus"]["rows"] == sum(len(by_team[t]) for t in config.team_ids),
        "Cobertura do grupo inconsistente.",
    )
    require(
        coverage["focus"]["unique_games"]
        == len({r["game_id"] for t in config.team_ids for r in by_team[t]}),
        "Partidas únicas do grupo inconsistentes.",
    )
    for scope in quality["missingness"].values():
        require(scope["missing_cells"] == 0, "Ausências não aprovadas no release.")
        require(
            all(
                not m["executed"] and m["p_value"] is None and m["statistic"] is None
                for m in scope["methods"]
            ),
            "Missingness inventa execução/estatística.",
        )

    descriptions = _index(documents["descriptives.json"]["results"], ["team_id", "metric"])
    require(set(descriptions) == _expected_pairs(config), "Descritivas incompletas.")
    for (team, metric), row in descriptions.items():
        n, stats, box = len(by_team[team]), row["statistics"], row["boxplot"]
        require(
            row["n"] == box["n"] == row["iqr_limits"]["n"] == n,
            "n do boxplot/descritivas divergente.",
        )
        for key in ("q1", "median", "q3", "iqr"):
            require(
                close(stats[key]["value"], box[key]) and close(box[key], row["iqr_limits"][key]),
                f"Quartis divergentes: {team}/{metric}/{key}.",
            )
        require(close(box["q3"] - box["q1"], box["iqr"]), "IQR incoerente.")
        require(
            close(box["lower_fence"], box["q1"] - box["k"] * box["iqr"])
            and close(box["upper_fence"], box["q3"] + box["k"] * box["iqr"]),
            "Cercas incoerentes.",
        )
        require(
            close(box["mean"], stats["mean"]["value"]) and box["modes"] == stats["modes"]["value"],
            "Centro/modas divergem do boxplot.",
        )
        column = get_metric(metric).canonical
        expected = {
            r["game_id"]
            for r in by_team[team]
            if r[column] < box["lower_fence"] or r[column] > box["upper_fence"]
        }
        require(
            {r["game_id"] for r in box["outliers"]} == expected
            and box["outlier_count"] == len(expected),
            "Outliers do boxplot divergem das observações.",
        )
        inside = [r[column] for r in by_team[team] if r["game_id"] not in expected]
        require(
            box["lower_whisker"] == min(inside) and box["upper_whisker"] == max(inside),
            "Bigodes não são extremos observados dentro das cercas.",
        )
        for outlier in box["outliers"]:
            source = index.get((team, outlier["game_id"]))
            require(
                source is not None
                and outlier["value"] == source[column]
                and outlier["game_date"] == source["game_date"],
                "Registro outlier incorreto.",
            )
        for name, measure in stats.items():
            require(
                measure["status"] != "ok" or measure["value"] is not None,
                f"Medida ok sem valor: {name}.",
            )
            require(
                measure["status"] == "ok" or measure["reason"],
                f"Medida indefinida sem motivo: {name}.",
            )

    comparisons = documents["comparisons.json"]
    require(set(comparisons["matrices"]) == {"cv", "iqr"}, "Quadros CV/IQR ausentes.")
    for name, matrix in comparisons["matrices"].items():
        require(matrix["team_ids"] == list(config.team_ids), "Colunas de times divergentes.")
        matrix_rows = _index(matrix["rows"], ["metric"])
        require(
            set(matrix_rows) == {(m,) for m in config.metrics}, "Quadro não tem sete variáveis."
        )
        for row in matrix["rows"]:
            require(set(row["teams"]) == set(config.team_ids), "Células de time ausentes.")
            for team, cell in row["teams"].items():
                expected = descriptions[team, row["metric"]]["statistics"][name]
                require(
                    {k: v for k, v in cell.items() if k != "n"} == expected
                    and cell["n"] == len(by_team[team]),
                    "Quadro difere das descritivas.",
                )
    for key in ("quartiles", "summary"):
        rows = _index(comparisons[key], ["team_id", "metric"])
        require(set(rows) == _expected_pairs(config), "Tabela comparativa incompleta.")
        for pair, row in rows.items():
            require(row["n"] == descriptions[pair]["n"], "n da tabela divergente.")
            if key == "summary":
                require(
                    row["statistics"] == descriptions[pair]["statistics"],
                    "Resumo difere das medidas.",
                )
            else:
                require(
                    all(row[k] == descriptions[pair]["statistics"][k] for k in ("q1", "q3", "iqr")),
                    "Tabela de quartis divergente.",
                )

    distributions = _index(documents["distributions.json"]["metrics"], ["metric"])
    require(set(distributions) == {(m,) for m in config.metrics}, "Distribuições incompletas.")
    for item in distributions.values():
        require(
            item["reference_team_ids"] == list(config.team_ids),
            "Referência do histograma divergente.",
        )
        require(
            item["pooled_n"] == sum(len(by_team[t]) for t in config.team_ids),
            "n combinado divergente.",
        )
        teams = _index(item["teams"], ["team_id"])
        require(set(teams) == {(t,) for t in config.team_ids}, "Distribuição sem time.")
        grids = []
        for entry in teams.values():
            h, kde, n = entry["histogram"], entry["kde"], len(by_team[entry["team_id"]])
            require(entry["n"] == h["n"] == kde["n"] == n, "n da distribuição divergente.")
            edges = h["edges"]
            require(
                edges == item["bin_parameters"]["edges"] and len(edges) == len(h["counts"]) + 1,
                "Bins incompatíveis.",
            )
            require(
                all(b > a for a, b in zip(edges, edges[1:], strict=False)),
                "Bins sem ordem estrita.",
            )
            counts = [0] * len(h["counts"])
            for row in by_team[entry["team_id"]]:
                value = row[get_metric(item["metric"]).canonical]
                pos = bisect_right(edges, value) - 1
                if value == edges[-1]:
                    pos -= 1
                require(0 <= pos < len(counts), "Valor fora dos bins publicados.")
                counts[pos] += 1
            require(
                counts == h["counts"] and sum(counts) == n, "Histograma perdeu/alterou observações."
            )
            require(len(h["density"]) == len(counts), "Densidade do histograma incompleta.")
            require(
                all(
                    close(d, c / (n * (edges[i + 1] - edges[i])))
                    for i, (c, d) in enumerate(zip(counts, h["density"], strict=True))
                ),
                "Densidade não corresponde às contagens.",
            )
            if kde["status"] == "ok":
                require(len(kde["x"]) == len(kde["density"]) >= 2, "Grade KDE incompatível.")
                require(
                    all(b > a for a, b in zip(kde["x"], kde["x"][1:], strict=False)),
                    "Grade KDE sem ordem.",
                )
                grids.append(kde["x"])
            else:
                require(kde["reason"] and not kde["density"], "KDE indisponível inventa curva.")
        require(not grids or all(grid == grids[0] for grid in grids), "Grades KDE não são comuns.")

    _validate_anomalies(documents, descriptions, by_team, index, config)
    sensitivity = documents["sensitivity.json"]
    require(
        sensitivity["selection"]["dbscan_eps"] == metadata["parameters"]["dbscan_eps"],
        "Seleção de eps divergente.",
    )
    require(
        {t["team_id"] for t in sensitivity["teams"]} == set(config.team_ids),
        "Sensibilidade sem time.",
    )
    variants = 0
    for team in sensitivity["teams"]:
        require(
            team["reference_n"] == len(by_team[team["team_id"]]), "n da sensibilidade divergente."
        )
        require(
            set(team["neighbor_methods"]) == {"knn", "lof"} and len(team["dbscan"]) == 10,
            "Grade de sensibilidade incompleta.",
        )
        entries = list(team["dbscan"])
        for method in team["neighbor_methods"].values():
            require(len(method["variants"]) == 6, "Grade k/escala incompleta.")
            entries.extend(method["variants"])
        for variant in entries:
            require(
                len(variant["observations"]) == len(by_team[team["team_id"]]),
                "Variante sem observações completas.",
            )
            ids = {r["game_id"] for r in variant["observations"] if r["is_outlier"]}
            require(
                sorted(ids) == variant["flagged_game_ids"] and len(ids) == variant["outlier_count"],
                "Flags de sensibilidade divergentes.",
            )
        variants += len(entries)
    require(variants == 44, "Quantidade de variantes divergente.")
    content = documents["content.json"]
    from backend.analytics.interpretations import describe_results

    require(content["interpretation_status"] == "descriptive_available", "Leituras ausentes.")
    require(
        _index(content["interpretations"], ["team_id", "metric"])
        == _index(
            describe_results(list(descriptions.values()), documents["games.json"]["rows"]),
            ["team_id", "metric"],
        ),
        "Leituras não correspondem às evidências descritivas.",
    )
    require(len(content["missingness"]["methods"]) == 4, "Discussão de missingness incompleta.")


def _validate_anomalies(documents, descriptions, by_team, index, config):
    report = documents["anomalies.json"]
    results = _index(report["results"], ["team_id", "metric", "method"])
    expected = {
        (team, metric, m)
        for team in config.team_ids
        for metric in config.metrics
        for m in ("zscore", "iqr", "grubbs")
    }
    expected |= {
        (team, None, m) for team in config.team_ids for m in ("ecod", "knn", "lof", "dbscan")
    }
    require(set(results) == expected, "Coleção de detectores incompleta.")
    summaries = _index(report["summary"], ["team_id", "metric", "method"])
    require(set(summaries) == expected, "Resumo de detectores incompleto.")
    for key, result in results.items():
        team, metric, method = key
        require(
            result["reference_n"]
            == result["display_n"]
            == result["reference"]["n"]
            == len(by_team[team]),
            "n dos detectores divergente.",
        )
        records = _index(result["records"], ["game_id"])
        require(
            set(records) == {(r["game_id"],) for r in by_team[team]},
            "Detector não cobre sua referência.",
        )
        known_flags = [r["is_outlier"] for r in result["records"]]
        count = sum(known_flags) if all(v is not None for v in known_flags) else None
        require(count == result["outlier_count"], "Contagem de anomalias divergente.")
        for row in result["records"]:
            source = index[team, row["game_id"]]
            require(
                row["team_id"] == team
                and row["game_date"] == source["game_date"]
                and row["matchup"] == source["matchup"],
                "Detector trocou identificação/contexto.",
            )
            require(
                set(row["values"]) == set(result["features"]), "Valores de features incompletos."
            )
            require(
                all(
                    row["values"][f] == source[get_metric(f).canonical] for f in result["features"]
                ),
                "Detector alterou observações.",
            )
            if method in {"ecod", "knn", "lof", "zscore"} and result["status"] == "ok":
                require(
                    row["score"] is not None
                    and row["is_outlier"] == (row["score"] > result["threshold"]),
                    "Score/limiar/flag incompatíveis.",
                )
            if method == "dbscan":
                require(
                    row["score"] is row["raw_score"] is None
                    and row["is_outlier"] == (row["cluster"] == -1),
                    "DBSCAN inventa score ou difere de ruído.",
                )
            if method == "lof" and result["status"] == "ok":
                require(close(row["score"], -row["raw_score"]), "Score LOF sem orientação correta.")
            if method == "ecod" and result["status"] == "ok":
                require(
                    close(row["score"], sum(row["feature_contributions"].values())),
                    "Contribuições ECOD não somam o score.",
                )
                require(
                    all(
                        0 < p["left"] <= 1 and 0 < p["right"] <= 1
                        for p in row["tail_probabilities"].values()
                    ),
                    "Cauda empírica inválida.",
                )
            if method == "knn" and result["status"] == "ok":
                neighbors = row["neighbor_game_ids"]
                require(
                    len(neighbors) == result["parameters"]["k"]
                    and len(set(neighbors)) == len(neighbors)
                    and row["game_id"] not in neighbors,
                    "k-NN inclui próprio ponto/vizinhos inválidos.",
                )
                require(
                    set(neighbors) <= {r["game_id"] for r in by_team[team]},
                    "Vizinho de outra referência.",
                )
        if method == "iqr":
            expected_ids = {r["game_id"] for r in descriptions[team, metric]["boxplot"]["outliers"]}
            require(
                {r["game_id"] for r in result["records"] if r["is_outlier"]} == expected_ids,
                "IQR e boxplot discordam.",
            )
        if method == "grubbs" and result["status"] == "ok":
            test = result["test"]
            require(
                test["rejected"] == (test["statistic"] > test["critical_value"]),
                "Decisão de Grubbs incompatível.",
            )
        require(
            summaries[key] == {k: result[k] for k in summaries[key]},
            "Resumo de anomalias divergente.",
        )


def validate_release(
    path: Path, config: Settings = settings, *, profile="build"
) -> tuple[dict, dict]:
    if profile not in {"build", "runtime"}:
        raise ArtifactError("Perfil de validação desconhecido.")
    manifest = validate_model(Manifest, read_json(path / "manifest.json"))
    require(
        manifest["schema_version"] == SCHEMA_VERSION == config.schema_version,
        "Schema incompatível.",
    )
    require(manifest["analysis_version"] == config.analysis_version, "Análise incompatível.")
    require(manifest["source"]["sha256"] == config.expected_dataset_sha256, "Dataset incompatível.")
    require(release_identity(manifest) == manifest["release_id"], "Identidade do release inválida.")
    require(
        set(manifest["artifacts"]) == set(ARTIFACT_MODELS) | set(PARQUET_MODELS),
        "Inventário de artefatos incompleto/desconhecido.",
    )
    documents = {}
    for name, entry in manifest["artifacts"].items():
        require(entry["runtime"] == (name in ARTIFACT_MODELS), "Política de runtime divergente.")
        if profile == "runtime" and not entry["runtime"]:
            continue
        file = path / name
        require(not file.is_symlink(), "Artefatos publicados não podem ser links simbólicos.")
        try:
            data = file.read_bytes()
        except OSError as error:
            raise ArtifactError(f"Artefato ausente: {name}.") from error
        require(
            digest(data) == entry["sha256"] and len(data) == entry["size_bytes"],
            f"Hash/tamanho divergente: {name}.",
        )
        if name in ARTIFACT_MODELS:
            require(
                entry["format"] == "json"
                and entry["schema_name"] == ARTIFACT_MODELS[name].__name__,
                "Schema/formato divergente.",
            )
            documents[name] = validate_model(ARTIFACT_MODELS[name], read_json(file))
    try:
        validate_relationships(documents, manifest, config)
    except (KeyError, TypeError, IndexError, AttributeError, ZeroDivisionError) as error:
        # Conteúdo extensível também precisa produzir erro de contrato legível no CLI/API.
        raise ArtifactError(f"Estrutura interna inválida entre artefatos: {error}") from error
    if profile == "build":
        _validate_parquet(path, documents, manifest, config)
    return manifest, documents


def _validate_parquet(path, documents, manifest, config):
    # Dependência offline; o import não ocorre no leitor online.
    import pyarrow.parquet as pq

    from backend.artifacts.parquet import parquet_schema

    games = documents["games.json"]["rows"]
    original = [c.canonical for c in COLUMNS]
    expected = {
        "canonical.parquet": [{k: r[k] for k in original} for r in games],
        "games.parquet": games,
        "focus.parquet": [r for r in games if r["team_id"] in config.team_ids],
    }
    for name, model in PARQUET_MODELS.items():
        entry = manifest["artifacts"][name]
        require(
            entry["format"] == "parquet" and entry["schema_name"] == model.__name__,
            "Schema Parquet divergente.",
        )
        table = pq.read_table(path / name)
        require(
            table.schema.equals(parquet_schema(name != "canonical.parquet"), check_metadata=False),
            "Tipos físicos Parquet incompatíveis.",
        )
        require(table.column_names == list(model.model_fields), "Colunas Parquet divergentes.")
        require(
            all(not f.nullable for f in table.schema), "Parquet publicado permite null indevido."
        )
        require(
            canonical_bytes(table.to_pylist()) == canonical_bytes(expected[name]),
            "Parquet e JSON divergem.",
        )
