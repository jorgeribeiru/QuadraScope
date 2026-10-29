"""Aplicabilidade de missingness; não executa testes inferenciais sem pressupostos."""

import json
from pathlib import Path

import pandas as pd


def missingness_report(frame: pd.DataFrame) -> dict:
    content_path = Path(__file__).resolve().parents[1] / "content" / "missingness.json"
    content = json.loads(content_path.read_text(encoding="utf-8"))
    count = int(frame.isna().sum().sum())
    varying = bool(frame.isna().nunique().gt(1).any())
    if frame.empty:
        state, reason = "not_applicable", "Não há observações."
    elif count == 0:
        state, reason = "not_applicable", "Não há células ausentes nem padrões a comparar."
    elif not varying:
        state, reason = (
            "not_applicable",
            "Indicadores de ausência constantes: sem grupos comparáveis.",
        )
    else:
        state, reason = (
            "requires_methodological_review",
            "Há ausência variável; desenho, padrões e pressupostos precisam de avaliação. "
            "Os testes inferenciais não estão implementados; nenhum foi executado.",
        )
    return {
        "missing_cells": count,
        "mechanism": "not_identified",
        "coverage_is_not_cell_missingness": True,
        "mechanisms": content["mechanisms"],
        "limitations": content["limitations"],
        "methods": [
            {
                **method,
                "status": state,
                "reason": reason,
                "executed": False,
                "statistic": None,
                "p_value": None,
                "implementation": "applicability_and_explanation_only",
            }
            for method in content["methods"]
        ],
        "references": content["references"],
    }
