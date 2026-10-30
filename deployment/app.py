"""Entrypoint único: API Python e SPA React na mesma origem."""

from pathlib import Path

from fastapi import HTTPException
from fastapi.staticfiles import StaticFiles

from backend.app.main import create_app

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
