"""Auditoria de domínio, consistência e pareamento antes de disponibilizar dados."""

from datetime import date

import numpy as np
import pandas as pd

from backend.analytics.metrics import COLUMNS, ColumnSpec
from backend.analytics.missingness import missingness_report
from backend.app.config import Settings, settings

PERCENT_TOLERANCE = 0.00050001


def _column_profile(frame: pd.DataFrame, spec: ColumnSpec) -> dict:
    values = frame[spec.canonical]
    missing = values.isna()
    numeric_kind = spec.kind in {"integer", "float", "boolean"}
    numeric = pd.to_numeric(values, errors="coerce") if numeric_kind else None
    if spec.kind == "identifier":
        valid = values.astype("string").str.fullmatch(r"[0-9]+", na=False)
    elif spec.kind == "string":
        valid = values.map(lambda x: isinstance(x, str) and bool(x) and x == x.strip())
    elif spec.kind == "date":
        valid = values.map(lambda x: type(x) is date)
    elif spec.kind == "boolean":
        valid = values.isin([True, False])
    else:
        valid = numeric.notna() & np.isfinite(numeric) & numeric.ge(0)
        if spec.kind == "integer":
            valid &= numeric.mod(1).eq(0)
        else:
            valid &= numeric.le(1)
    return {
        "original": spec.original,
        "canonical": spec.canonical,
        "n": len(values),
        "missing": int(missing.sum()),
        "zeros": int(numeric.eq(0).sum()) if numeric_kind else None,
        "negatives": int(numeric.lt(0).sum()) if spec.kind in {"integer", "float"} else None,
        "outside_domain": int((~missing & ~valid).sum()),
        "domain": spec.domain,
        "special_value_policy": "Zero é válido se atender ao domínio; não é imputado ou removido.",
        "outliers": {
            "status": "not_evaluated" if spec.kind in {"integer", "float"} else "not_applicable",
            "count": None,
            "reason": "Métodos estatísticos pertencem às etapas 4–5; IDs/texto não são magnitudes.",
        },
    }


def _references(frame: pd.DataFrame, mask: pd.Series) -> list[dict]:
    selected = frame.loc[mask.fillna(False), ["team_id", "game_id"]].head(10)
    return [
        {"team_id": str(row.team_id), "game_id": str(row.game_id)}
        for row in selected.itertuples(index=False)
    ]


def _add_check(checks: list, frame: pd.DataFrame, rule: str, bad: pd.Series, description: str):
    bad = bad.fillna(True)
    checks.append(
        {
            "rule": rule,
            "severity": "blocker",
            "status": "fail" if bad.any() else "pass",
            "affected_records": int(bad.sum()),
            "description": description,
            "examples": _references(frame, bad),
        }
    )


def _add_warning(checks: list, rule: str, count: int, description: str, unit="team_game_records"):
    checks.append(
        {
            "rule": rule,
            "severity": "warning",
            "status": "observed" if count else "pass",
            "count": int(count),
            "unit": unit,
            "description": description,
        }
    )


def _row_checks(data: pd.DataFrame, checks: list) -> None:
    pairs = [
        ("field_goals_made", "field_goals_attempted", "field_goal_rate"),
        ("three_pointers_made", "three_pointers_attempted", "three_point_rate"),
        ("free_throws_made", "free_throws_attempted", "free_throw_rate"),
    ]
    for made, attempted, rate in pairs:
        _add_check(
            checks,
            data,
            f"{made}_le_attempted",
            data[made].gt(data[attempted]),
            "Convertidos não podem exceder tentados.",
        )
        # Razão não definida com zero tentativas; nenhuma divisão por zero é executada.
        defined = data[attempted].gt(0)
        expected = data[made].astype("Float64").div(data[attempted].where(defined))
        bad = defined & (expected - data[rate]).abs().gt(PERCENT_TOLERANCE)
        _add_check(
            checks, data, f"{rate}_rounded", bad, "Percentual respeita arredondamento de 3 casas."
        )
        _add_warning(
            checks,
            f"{rate}_undefined",
            int((~defined).sum()),
            "Denominador zero: razão não avaliada; valor da fonte é preservado.",
        )
    _add_check(
        checks,
        data,
        "threes_le_field_goals",
        data.three_pointers_made.gt(data.field_goals_made),
        "FG3M ≤ FGM.",
    )
    _add_check(
        checks,
        data,
        "three_attempts_le_field_attempts",
        data.three_pointers_attempted.gt(data.field_goals_attempted),
        "FG3A ≤ FGA.",
    )
    points = (
        2 * data.field_goals_made.astype(object) + data.three_pointers_made + data.free_throws_made
    )
    _add_check(checks, data, "points_identity", points.ne(data.points), "2*FGM + FG3M + FTM = PTS.")
    rebounds = data.offensive_rebounds.astype(object) + data.defensive_rebounds
    _add_check(checks, data, "rebounds_identity", rebounds.ne(data.rebounds), "OREB + DREB = REB.")
    invalid_minutes = data.team_minutes.lt(240) | (data.team_minutes - 240).mod(25).ne(0)
    _add_check(
        checks, data, "team_minutes_domain", invalid_minutes, "MIN = 240 + 25*k, k inteiro ≥ 0."
    )


def _cumulative_checks(data: pd.DataFrame, checks: list) -> None:
    total = data.cumulative_wins.astype(object) + data.cumulative_losses
    positive = total.gt(0)
    _add_check(
        checks, data, "cumulative_total_positive", ~positive, "W+L deve ser positivo após jogo."
    )
    expected = data.cumulative_wins.astype("Float64").div(total.where(positive).astype("Float64"))
    _add_check(
        checks,
        data,
        "cumulative_win_rate",
        positive & (expected - data.cumulative_win_rate).abs().gt(PERCENT_TOLERANCE),
        "W_PCT = W/(W+L), tolerância absoluta de 0,00050001.",
    )
    bad = pd.Series(False, index=data.index)
    skipped = 0
    for _, group in data.groupby("team_id", sort=False):
        group = group.sort_values(["game_date", "game_id"])
        wins = group.cumulative_wins.astype(object)
        losses = group.cumulative_losses.astype(object)
        games = wins + losses
        dw, dl, dg = wins.diff(), losses.diff(), games.diff()
        won = group.won.astype(int)
        first = group.index[0]
        if games.iloc[0] == 1:
            bad.loc[first] = wins.iloc[0] != won.iloc[0] or losses.iloc[0] != 1 - won.iloc[0]
        skipped += max(0, int(games.iloc[0]) - 1)
        for idx in group.index[1:]:
            bad.loc[idx] = (
                dg.loc[idx] < 1 or dw.loc[idx] < won.loc[idx] or dl.loc[idx] < 1 - won.loc[idx]
            )
            if dg.loc[idx] >= 1:
                skipped += int(dg.loc[idx]) - 1
    _add_check(
        checks,
        data,
        "cumulative_sequence",
        bad,
        "Acumulados aumentam e são compatíveis com os resultados observados.",
    )
    _add_warning(
        checks,
        "cumulative_unobserved_games",
        skipped,
        "Saltos/início após o primeiro jogo indicam cobertura não observada, não células missing.",
        unit="team_games_inferred_from_counters",
    )


def _pair_games(data: pd.DataFrame) -> pd.DataFrame:
    """Duas linhas verificadas por jogo; merge 1:1 evita produto cartesiano silencioso."""
    left = data.copy()
    left["_side"] = left.groupby("game_id").cumcount()
    parsed = left.matchup.str.extract(r"^([A-Z]{2,4}) (vs\.|@) ([A-Z]{2,4})$")
    left["_own"], left["_venue"], left["_opponent"] = parsed[0], parsed[1], parsed[2]
    right = left[
        [
            "game_id",
            "_side",
            "team_id",
            "points",
            "won",
            "game_date",
            "team_minutes",
            "_own",
            "_venue",
            "_opponent",
        ]
    ].copy()
    right["_side"] = 1 - right["_side"]
    right = right.rename(columns={c: "_other_" + c for c in right if c not in {"game_id", "_side"}})
    return left.merge(right, on=["game_id", "_side"], how="left", validate="one_to_one", sort=False)


def _pair_checks(paired: pd.DataFrame, checks: list) -> None:
    _add_check(
        checks,
        paired,
        "game_same_date",
        paired.game_date.ne(paired._other_game_date),
        "Duas linhas da partida devem ter a mesma data.",
    )
    _add_check(
        checks,
        paired,
        "game_same_minutes",
        paired.team_minutes.ne(paired._other_team_minutes),
        "Minutos agregados iguais para adversários da mesma partida.",
    )
    _add_check(
        checks,
        paired,
        "game_opposite_outcome",
        paired.won.eq(paired._other_won),
        "Uma vitória e uma derrota por jogo.",
    )
    _add_check(
        checks,
        paired,
        "outcome_matches_score",
        paired.points.eq(paired._other_points)
        | paired.won.ne(paired.points.gt(paired._other_points)),
        "Sem empate; vitória coerente com os pontos do adversário.",
    )
    _add_check(
        checks,
        paired,
        "matchup_opponent",
        paired._opponent.ne(paired._other__own) | paired._own.ne(paired._other__opponent),
        "Siglas de adversário recíprocas.",
    )
    _add_check(
        checks,
        paired,
        "matchup_venue",
        paired._venue.eq(paired._other__venue),
        "Uma linha em casa (vs.) e outra fora (@).",
    )


def coverage(data: pd.DataFrame, config: Settings = settings) -> dict:
    """Somente para dados tipados e enriquecidos aprovados nas regras bloqueantes."""
    teams = []
    for team_id, group in data.groupby("team_id", sort=True):
        teams.append(
            {
                "team_id": str(team_id),
                "team_name": str(group.team_name.iloc[0]),
                "rows": len(group),
                "wins": int(group.won.sum()),
                "losses": int((~group.won).sum()),
                "win_rate": float(group.won.mean()),
                "home": int(group.venue.eq("home").sum()),
                "away": int(group.venue.eq("away").sum()),
                "overtime_games": int(group.overtime_periods.gt(0).sum()),
                "from": group.game_date.min().isoformat(),
                "to": group.game_date.max().isoformat(),
            }
        )
    focus = data[data.team_id.isin(config.team_ids)]
    h2h = focus[focus.opponent_id.isin(config.team_ids)]
    return {
        "rows": len(data),
        "teams": len(teams),
        "unique_games": int(data.game_id.nunique()),
        "from": data.game_date.min().isoformat(),
        "to": data.game_date.max().isoformat(),
        "by_team": teams,
        "team_game_totals": {
            "wins": int(data.won.sum()),
            "losses": int((~data.won).sum()),
            "home": int(data.venue.eq("home").sum()),
            "away": int(data.venue.eq("away").sum()),
            "overtime_records": int(data.overtime_periods.gt(0).sum()),
            "overtime_unique_games": int(
                data.loc[data.overtime_periods.gt(0), "game_id"].nunique()
            ),
        },
        "focus": {
            "team_ids": list(config.team_ids),
            "rows": len(focus),
            "unique_games": int(focus.game_id.nunique()),
            "head_to_head_games": int(h2h.game_id.nunique()),
            "head_to_head": [
                {
                    "game_id": str(gid),
                    "date": group.game_date.iloc[0].isoformat(),
                    "team_ids": group.team_id.astype(str).tolist(),
                    "points": [int(x) for x in group.points],
                }
                for gid, group in h2h.groupby("game_id", sort=True)
            ],
        },
        "completeness": "Recorte: calendário e autenticidade sem verificação externa.",
    }


def audit_quality(
    canonical: pd.DataFrame, config: Settings = settings
) -> tuple[dict, pd.DataFrame | None]:
    data = canonical.reset_index(drop=True).copy()
    profiles = [_column_profile(data, spec) for spec in COLUMNS]
    checks = []
    for profile in profiles:
        checks.append(
            {
                "rule": "column_domain:" + profile["canonical"],
                "severity": "blocker",
                "status": "fail" if profile["missing"] or profile["outside_domain"] else "pass",
                "missing": profile["missing"],
                "outside_domain": profile["outside_domain"],
                "description": "Sem ausências e dentro do domínio para liberar dados à análise.",
            }
        )
    checks.append(
        {"rule": "nonempty", "severity": "blocker", "status": "pass" if len(data) else "fail"}
    )
    _add_check(checks, data, "duplicate_rows", data.duplicated(keep=False), "Linhas repetidas.")
    _add_check(
        checks,
        data,
        "duplicate_key",
        data.duplicated(["team_id", "game_id"], keep=False),
        "Chave time-partida deve ser única.",
    )
    enriched = None
    domain_ok = bool(len(data)) and all(
        p["missing"] == 0 and p["outside_domain"] == 0 for p in profiles
    )
    if domain_ok:
        _add_check(
            checks,
            data,
            "team_name_consistency",
            data.groupby("team_id").team_name.transform("nunique").ne(1),
            "Um nome por ID.",
        )
        _add_check(
            checks,
            data,
            "team_id_consistency",
            data.groupby("team_name").team_id.transform("nunique").ne(1),
            "Um ID por nome.",
        )
        _row_checks(data, checks)
        _cumulative_checks(data, checks)
        parsed = data.matchup.str.extract(r"^([A-Z]{2,4}) (vs\.|@) ([A-Z]{2,4})$")
        _add_check(
            checks, data, "matchup_format", parsed.isna().any(axis=1), "Formato SIGLA vs./@ SIGLA."
        )
        _add_check(
            checks,
            data,
            "game_two_rows",
            data.groupby("game_id").game_id.transform("size").ne(2),
            "Exatamente duas linhas por partida.",
        )
        _add_check(
            checks,
            data,
            "game_distinct_teams",
            data.groupby("game_id").team_id.transform("nunique").ne(2),
            "Adversários com IDs diferentes.",
        )
        if not parsed.isna().any().any():
            own = data.assign(_abbr=parsed[0])
            _add_check(
                checks,
                data,
                "team_abbreviation_consistency",
                own.groupby("team_id")._abbr.transform("nunique").ne(1)
                | own.groupby("_abbr").team_id.transform("nunique").ne(1),
                "Sigla consistente com um único time no dataset.",
            )
        pair_ready = all(
            c["status"] != "fail"
            for c in checks
            if c["rule"]
            in {"duplicate_key", "game_two_rows", "game_distinct_teams", "matchup_format"}
        )
        if pair_ready:
            paired = _pair_games(data)
            _pair_checks(paired, checks)
            if not any(c["severity"] == "blocker" and c["status"] == "fail" for c in checks):
                enriched = paired.loc[:, list(canonical.columns)].copy()
                enriched["opponent_id"] = paired._other_team_id
                enriched["opponent_points"] = paired._other_points
                enriched["point_margin"] = paired.points - paired._other_points
                enriched["venue"] = paired._venue.map({"vs.": "home", "@": "away"}).astype("string")
                enriched["overtime_periods"] = ((paired.team_minutes - 240) // 25).astype("Int64")
        else:
            checks.append(
                {
                    "rule": "pair_checks",
                    "severity": "blocker",
                    "status": "not_evaluated",
                    "description": "Chaves, cardinalidade ou matchup impedem pareamento seguro.",
                }
            )
        _add_warning(
            checks, "zero_blocks", int(data.blocks.eq(0).sum()), "Zero tocos pode ser legítimo."
        )
        _add_warning(
            checks, "zero_steals", int(data.steals.eq(0).sum()), "Zero roubos pode ser legítimo."
        )
        _add_warning(
            checks,
            "overtime_exposure",
            int(data.team_minutes.gt(240).sum()),
            "Prorrogações aumentam exposição dos totais por jogo.",
        )
    else:
        checks.append(
            {
                "rule": "consistency_checks",
                "severity": "blocker",
                "status": "not_evaluated",
                "description": "Base vazia, ausência ou domínio inválido impede cálculos seguros.",
            }
        )
    failed = [c["rule"] for c in checks if c["severity"] == "blocker" and c["status"] == "fail"]
    focus = data[data.team_id.isin(config.team_ids)]
    report = {
        "status": "passed" if not failed else "blocked",
        "failed_rules": failed,
        "checks": checks,
        "columns": profiles,
        "focus_columns": [_column_profile(focus, spec) for spec in COLUMNS],
        "duplicates": {
            "row_excess": int(data.duplicated().sum()),
            "key_excess": int(data.duplicated(["team_id", "game_id"]).sum()),
        },
        "missingness": {"global": missingness_report(data), "focus": missingness_report(focus)},
        "coverage": coverage(enriched, config) if enriched is not None else None,
        "parameters": {
            "percent_tolerance": PERCENT_TOLERANCE,
            "missing_policy": "block_without_imputation",
        },
    }
    return report, enriched
