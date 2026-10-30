"""Mede API publicada sem autenticação; distingue início do worker e latência HTTP."""

import argparse
import json
import math
import re
import statistics
import time
import urllib.parse
import urllib.request
from datetime import UTC, datetime
from pathlib import Path

SCENARIOS = {
    "health": "/api/v1/health",
    "summary_atlanta_home": "/api/v1/teams/1610612737/summary?venue=home",
    "comparison_home": "/api/v1/comparisons?venue=home&metric=PTS",
    "lof_houston_home": "/api/v1/anomalies?team_id=1610612745&method=lof&venue=home",
}


def summarize(values):
    ordered = sorted(values)
    return {
        "n": len(values),
        "median_ms": statistics.median(values),
        "p95_nearest_rank_ms": ordered[math.ceil(0.95 * len(ordered)) - 1],
        "max_ms": max(values),
    }


def measure(base, release, deployment, samples=5):
    parsed = urllib.parse.urlsplit(base)
    if (
        parsed.scheme not in {"http", "https"}
        or not parsed.netloc
        or parsed.query
        or parsed.fragment
        or parsed.path not in {"", "/"}
    ):
        raise ValueError("Informe uma origem HTTP(S) sem query.")
    if samples < 2:
        raise ValueError("Use pelo menos duas amostras por cenário.")
    records, workers = [], {}
    for scenario, path in SCENARIOS.items():
        for _ in range(samples):
            request = urllib.request.Request(
                base.rstrip("/") + path,
                headers={"Accept": "application/json", "Cache-Control": "no-cache"},
            )
            started = time.perf_counter()
            with urllib.request.urlopen(request, timeout=60) as response:
                headers_ms = (time.perf_counter() - started) * 1000
                payload = json.load(response)
                total_ms = (time.perf_counter() - started) * 1000
                worker = response.headers.get("x-quadrascope-worker", "")
                first = response.headers.get("x-quadrascope-first-request")
                timing = {
                    key: float(value)
                    for key, value in re.findall(
                        r"(qs_\w+);dur=([0-9.]+)", response.headers.get("server-timing", "")
                    )
                }
                actual_release = payload.get("release_id") or payload["context"]["release_id"]
                if actual_release != release:
                    raise ValueError("Release divergente; medição interrompida.")
                if (
                    not re.fullmatch(r"[a-f0-9]{32}", worker)
                    or first not in {"0", "1"}
                    or set(timing) != {"qs_import", "qs_startup", "qs_app"}
                    or any(not math.isfinite(v) or v < 0 for v in timing.values())
                ):
                    raise ValueError("Instrumentação ausente ou inválida no deployment.")
                if scenario == "lof_houston_home" and (
                    payload["result"]["reference_n"] != 74 or payload["result"]["display_n"] != 35
                ):
                    raise ValueError("Referência/exibição LOF divergentes.")
                records.append(
                    {
                        "scenario": scenario,
                        "worker_id": worker,
                        "first_http_in_worker": first == "1",
                        "http_headers_ms": headers_ms,
                        "http_total_ms": total_ms,
                        **timing,
                    }
                )
                workers.setdefault(
                    worker,
                    {
                        "import_ms": timing["qs_import"],
                        "startup_ms": timing["qs_startup"],
                        "application_initialization_ms": timing["qs_import"] + timing["qs_startup"],
                    },
                )
    first_requests = [r for r in records if r["first_http_in_worker"]]
    return {
        "generated_at": datetime.now(UTC).isoformat(),
        "base_url": base,
        "deployment_id": deployment,
        "release_id": release,
        "status": "passed",
        "first_http_observed": bool(first_requests),
        "method": "application_instrumentation_and_client_http",
        "platform_provisioning_isolated": False,
        "limitations": [
            "Importação começa na execução de app.py, após importar time.",
            "Startup é a entrada no lifespan, incluindo validação/carregamento dos artefatos.",
            "Tempos de inicialização são recuperados também nas respostas quentes.",
            "Primeira requisição HTTP do worker pode ocorrer após pré-aquecimento.",
            "HTTP inclui rede/TLS e plataforma; não isola custo causal do cold start.",
            "qs_app mede atendimento até os headers; não inclui envio do corpo.",
            "Amostra pequena e sequencial; p95 usa nearest-rank e não estima SLA.",
        ],
        "workers": workers,
        "first_requests": first_requests,
        "summary": {
            scenario: {
                "http_total": summarize(
                    [r["http_total_ms"] for r in records if r["scenario"] == scenario]
                ),
                "app_until_headers": summarize(
                    [r["qs_app"] for r in records if r["scenario"] == scenario]
                ),
            }
            for scenario in SCENARIOS
        },
        "records": records,
    }


if __name__ == "__main__":
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--base-url", required=True)
    parser.add_argument("--release", required=True)
    parser.add_argument("--deployment", required=True)
    parser.add_argument("--samples", type=int, default=5)
    parser.add_argument("--output", type=Path, required=True)
    args = parser.parse_args()
    report = measure(args.base_url, args.release, args.deployment, args.samples)
    args.output.parent.mkdir(parents=True, exist_ok=True)
    args.output.write_text(json.dumps(report, ensure_ascii=False, indent=2) + "\n")
    print(json.dumps({key: report[key] for key in ["status", "workers", "summary"]}, indent=2))
