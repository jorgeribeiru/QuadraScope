"""Entrypoint único: API Python e SPA React na mesma origem."""

# O relógio começa antes de importar FastAPI, pandas, SciPy e os módulos da API.
# ruff: noqa: E402
from time import perf_counter

_entry_started = perf_counter()

from pathlib import Path

from fastapi import HTTPException
from fastapi.staticfiles import StaticFiles

from backend.app.main import create_app
from backend.app.telemetry import instrument

app = create_app()


@app.api_route(
    "/api/{unmatched:path}",
    methods=["GET", "HEAD", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"],
    include_in_schema=False,
)
def unknown_api(unmatched: str):
    raise HTTPException(404, "Rota de API inexistente.")


web = Path(__file__).parent / "web"
app.mount("/assets", StaticFiles(directory=web / "assets"), name="assets")
app.frontend("/", directory=web, fallback="index.html")

# Inclui configuração das rotas; exclui provisionamento e boot anterior do Python.
instrument(app, (perf_counter() - _entry_started) * 1000)
