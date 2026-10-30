"""Tempos do processo da aplicação; não medem provisionamento da plataforma."""

from contextlib import asynccontextmanager
from time import perf_counter
from uuid import uuid4


class DeploymentTiming:
    """ASGI puro: mede até os headers, sem consumir corpos nem alterar contratos."""

    def __init__(self, app, metrics):
        self.app = app
        self.metrics = metrics
        self.seen_http = False

    async def __call__(self, scope, receive, send):
        if scope["type"] != "http":
            return await self.app(scope, receive, send)
        # Sem await entre leitura/escrita: só uma requisição ganha o marcador.
        first = not self.seen_http
        self.seen_http = True
        started = perf_counter()

        async def timed_send(message):
            if message["type"] == "http.response.start" and scope["path"].startswith("/api/"):
                headers = list(message.get("headers", []))
                timings = {
                    "qs_import": self.metrics["import_ms"],
                    "qs_startup": self.metrics.get("startup_ms", 0),
                    "qs_app": (perf_counter() - started) * 1000,
                }
                headers.extend(
                    [
                        (b"x-quadrascope-worker", self.metrics["worker_id"].encode()),
                        (b"x-quadrascope-first-request", b"1" if first else b"0"),
                        (
                            b"server-timing",
                            ", ".join(
                                f"{key};dur={value:.3f}" for key, value in timings.items()
                            ).encode(),
                        ),
                    ]
                )
                message = {**message, "headers": headers}
            await send(message)

        await self.app(scope, receive, timed_send)


def instrument(application, import_ms):
    """Importação uma vez por módulo; startup medido em cada entrada no lifespan."""
    metrics = {"worker_id": uuid4().hex, "import_ms": import_ms}
    original = application.router.lifespan_context

    @asynccontextmanager
    async def lifespan(app):
        started = perf_counter()
        async with original(app) as state:
            metrics["startup_ms"] = (perf_counter() - started) * 1000
            yield state

    application.router.lifespan_context = lifespan
    application.add_middleware(DeploymentTiming, metrics=metrics)
