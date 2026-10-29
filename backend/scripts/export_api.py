"""Exporta OpenAPI determinístico sem exigir artefatos nem iniciar servidor."""

from backend.app.config import settings
from backend.app.main import create_app
from backend.artifacts.serialization import canonical_bytes


def export_openapi():
    destination = settings.project_root / "docs/api/openapi.json"
    destination.parent.mkdir(parents=True, exist_ok=True)
    destination.write_bytes(canonical_bytes(create_app().openapi()))
    return destination


if __name__ == "__main__":
    print(export_openapi())
