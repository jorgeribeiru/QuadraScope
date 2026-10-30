"""Prova local do pacote preparado; medições não equivalem a cold start da Vercel."""

import argparse
import gzip
import json
import os
import socket
import statistics
import subprocess
import tempfile
import time
import urllib.error
import urllib.request
from pathlib import Path

from backend.app.config import settings
from backend.artifacts.serialization import canonical_bytes, digest


def fetch(base, path, *, html=False):
    request = urllib.request.Request(
        base + path, headers={"Accept": "text/html" if html else "application/json"}
    )
    start = time.perf_counter()
    try:
        with urllib.request.urlopen(request, timeout=20) as response:
            return response.status, response.read(), time.perf_counter() - start
    except urllib.error.HTTPError as error:
        return error.code, error.read(), time.perf_counter() - start


def benchmark(python: str, runs: int = 3) -> dict:
    package = settings.project_root / ".deployment"
    manifest = json.loads((package / "package-manifest.json").read_text())
    cold, latencies, memory = [], {}, []
    checks = {}
    runtime_environment = None
    for _ in range(runs):
        with socket.socket() as sock:
            sock.bind(("127.0.0.1", 0))
            port = sock.getsockname()[1]
        env = {
            k: v
            for k, v in os.environ.items()
            if k not in {"QUADRASCOPE_ARTIFACT_ROOT", "PYTHONPATH"}
        }
        check = subprocess.check_output(
            [
                python,
                "-c",
                "import importlib.util,json,platform,site; "
                "print(json.dumps({'python':platform.python_version(),"
                "'site_packages':site.getsitepackages(),'offline_absent':all("
                "importlib.util.find_spec(n) is None for n in "
                "['pyarrow','sklearn','threadpoolctl','pyod'])}))",
            ],
            cwd=package,
            env=env,
            text=True,
        )
        runtime_environment = json.loads(check)
        if not runtime_environment["offline_absent"]:
            raise ValueError(
                "Use ambiente isolado por requirements-runtime.txt, sem dependências offline."
            )
        with tempfile.TemporaryFile() as logs:
            start = time.perf_counter()
            process = subprocess.Popen(
                [
                    python,
                    "-m",
                    "uvicorn",
                    "app:app",
                    "--host",
                    "127.0.0.1",
                    "--port",
                    str(port),
                    "--log-level",
                    "warning",
                ],
                cwd=package,
                env=env,
                stdout=logs,
                stderr=logs,
            )
            try:
                base = f"http://127.0.0.1:{port}"
                while time.perf_counter() - start < 20:
                    if process.poll() is not None:
                        logs.seek(0)
                        raise RuntimeError(logs.read().decode())
                    try:
                        status, body, _ = fetch(base, "/api/v1/health")
                        if status != 200:
                            raise ValueError(f"Health inválido: {status}, {body[:200]!r}")
                        cold.append(time.perf_counter() - start)
                        break
                    except (urllib.error.URLError, ConnectionError):
                        time.sleep(0.02)
                else:
                    raise TimeoutError("Pacote não iniciou em 20 segundos.")
                for path, expected, html in [
                    ("/", 200, True),
                    ("/comparar?venue=home", 200, True),
                    ("/times/1610612745?venue=home", 200, True),
                    ("/api/v1/missing", 404, True),
                    ("/assets/missing.js", 404, True),
                ]:
                    status, _, _ = fetch(base, path, html=html)
                    if status != expected:
                        raise ValueError(
                            f"Roteamento inválido: {path}: {status}, esperado {expected}."
                        )
                    checks[path] = status
                for path in [
                    "/api/v1/teams/1610612737/summary?venue=home",
                    "/api/v1/comparisons?venue=home&metric=PTS",
                    "/api/v1/anomalies?team_id=1610612745&method=lof&venue=home",
                ]:
                    values = latencies.setdefault(path, [])
                    for _sample in range(5):
                        status, body, elapsed = fetch(base, path)
                        if status != 200:
                            raise ValueError(f"Consulta inválida: {path}: {status}.")
                        data = json.loads(body)
                        if data["context"]["release_id"] != manifest["release_id"]:
                            raise ValueError("Release das respostas diverge do pacote.")
                        if "/anomalies" in path:
                            assert (
                                data["result"]["reference_n"] == 74
                                and data["result"]["display_n"] == 35
                            )
                        values.append(elapsed * 1000)
                status_file = Path(f"/proc/{process.pid}/status")
                if status_file.exists():
                    for line in status_file.read_text().splitlines():
                        if line.startswith("VmRSS:"):
                            memory.append(int(line.split()[1]) * 1024)
            finally:
                process.terminate()
                process.wait(timeout=10)
    site_bytes = sum(
        file.stat().st_size
        for directory in runtime_environment["site_packages"]
        for file in Path(directory).rglob("*")
        if file.is_file()
    )
    bundles = {}
    for file in sorted((package / "web").rglob("*.js")):
        data = file.read_bytes()
        bundles[str(file.relative_to(package / "web"))] = {
            "bytes": len(data),
            "gzip_bytes": len(gzip.compress(data, mtime=0)),
        }
    report = {
        "status": "passed",
        "environment": "local_linux_uvicorn",
        "cloud_verified": False,
        "release_id": manifest["release_id"],
        "package_manifest_sha256": digest((package / "package-manifest.json").read_bytes()),
        "source_size_bytes": manifest["source_size_bytes"],
        "runtime_site_packages_bytes": site_bytes,
        "estimated_uncompressed_bytes": site_bytes + manifest["source_size_bytes"],
        "runtime": runtime_environment,
        "cold_start_seconds": cold,
        "cold_start_median_seconds": statistics.median(cold),
        "observed_rss_bytes": memory,
        "latency_ms": {
            path: {
                "samples": len(values),
                "median": statistics.median(values),
                "p95": statistics.quantiles(values, n=100, method="inclusive")[94],
                "max": max(values),
            }
            for path, values in latencies.items()
        },
        "routing_checks": checks,
        "frontend_bundles": bundles,
    }
    (settings.processed_data_dir / "deployment-verification.json").write_bytes(
        canonical_bytes(report)
    )
    return report


if __name__ == "__main__":
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument(
        "--python", required=True, help="Python absoluto do ambiente isolado de runtime"
    )
    args = parser.parse_args()
    print(json.dumps(benchmark(str(Path(args.python).absolute())), indent=2))
