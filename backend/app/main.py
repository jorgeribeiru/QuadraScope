"""API readonly sobre um release validado, fixado durante o ciclo de vida do processo."""

import logging
import os
from contextlib import asynccontextmanager
from pathlib import Path
from typing import Annotated

from fastapi import APIRouter, Depends, FastAPI, HTTPException, Query, Request
from fastapi import Path as PathParameter
from fastapi.exceptions import RequestValidationError
from fastapi.responses import JSONResponse, Response
from starlette.exceptions import HTTPException as StarletteHTTPException

from backend.app import schemas
from backend.app.config import Settings, settings
from backend.app.queries import (
    AnomalyQuery,
    ComparisonQuery,
    DistributionQuery,
    Filters,
    InterpretationQuery,
    NoQuery,
)
from backend.app.services import AnalysisService
from backend.artifacts.serialization import ArtifactError, canonical_bytes, digest
from backend.repositories.artifacts import ArtifactRepository

logger = logging.getLogger(__name__)
ERRORS = {code: {"model": schemas.ErrorResponse} for code in (404, 422, 503)}


def error_response(status, code, message, details=None):
    return JSONResponse(
        status_code=status,
        content={"error": {"code": code, "message": message, "details": details or []}},
        headers={"Cache-Control": "no-store"},
    )


def service(request: Request) -> AnalysisService:
    current = getattr(request.app.state, "analysis", None)
    if current is None:
        raise HTTPException(
            503,
            "Artefatos indisponíveis ou incompatíveis. "
            "Gere/valide o pacote de dados e reinicie a API.",
        )
    return current


Service = Annotated[AnalysisService, Depends(service)]


def ensure_team(team, analysis):
    if team not in analysis.team_ids:
        raise HTTPException(404, "Time inexistente neste dataset.")
    if team not in analysis.config.team_ids:
        raise HTTPException(
            422, "Time disponível somente como contexto; análise limitada a Atlanta/Houston."
        )


def respond(request, model, data):
    # A mesma validação estrita JSON admite datas ISO sem coerção de números/textos.
    payload = model.model_validate_json(canonical_bytes(data)).model_dump(
        mode="json", by_alias=True
    )
    etag = '"' + digest(canonical_bytes(payload)) + '"'
    headers = {"ETag": etag, "Cache-Control": "private, max-age=0, must-revalidate"}
    candidates = [
        value.strip().removeprefix("W/")
        for value in request.headers.get("if-none-match", "").split(",")
    ]
    if etag in candidates or "*" in candidates:
        return Response(status_code=304, headers=headers)
    return JSONResponse(payload, headers=headers)


def create_app(config: Settings = settings, artifact_root: Path | None = None) -> FastAPI:
    configured_root = artifact_root
    if configured_root is None:
        configured_root = Path(
            os.environ.get("QUADRASCOPE_ARTIFACT_ROOT", config.processed_data_dir)
        )

    @asynccontextmanager
    async def lifespan(application):
        application.state.analysis = None
        try:
            repository = ArtifactRepository(configured_root, config)
            application.state.analysis = AnalysisService(repository, config)
        except (ArtifactError, OSError) as error:
            logger.error("Não foi possível carregar os artefatos: %s", error)
        yield
        application.state.analysis = None

    application = FastAPI(
        title="QuadraScope API",
        version="1.0.0",
        description="Relatório descritivo Atlanta Hawks × Houston Rockets. "
        "Artefatos readonly; datas inclusivas.",
        lifespan=lifespan,
    )

    @application.exception_handler(RequestValidationError)
    async def validation_error(request, error):
        details = [
            {"location": list(item["loc"]), "message": item["msg"], "type": item["type"]}
            for item in error.errors()
        ]
        return error_response(422, "invalid_query", "Consulta inválida.", details)

    @application.exception_handler(StarletteHTTPException)
    async def http_error(request, error):
        codes = {404: "not_found", 422: "out_of_scope", 503: "artifacts_unavailable"}
        return error_response(
            error.status_code, codes.get(error.status_code, "http_error"), str(error.detail)
        )

    @application.exception_handler(ArtifactError)
    async def artifact_error(request, error):
        logger.error("Falha no pacote de dados: %s", error)
        return error_response(
            503, "artifacts_unavailable", "Pacote de dados indisponível ou incompatível."
        )

    # Rejeitar parâmetros repetidos evita seleção ambígua e identidades de cache inconsistentes.
    @application.middleware("http")
    async def unique_query(request, call_next):
        keys = list(request.query_params.keys())
        if any(len(request.query_params.getlist(key)) != 1 for key in keys):
            return error_response(
                422, "invalid_query", "Parâmetros de consulta não podem ser repetidos."
            )
        return await call_next(request)

    router = APIRouter(
        prefix="/api/v1", responses={**ERRORS, 304: {"description": "Conteúdo não modificado"}}
    )

    @router.get("/health", response_model=schemas.HealthResponse)
    def health(request: Request, analysis: Service, query: Annotated[NoQuery, Query()]):
        manifest = analysis.manifest
        return respond(
            request,
            schemas.HealthResponse,
            {
                "status": "ready",
                "api_version": "1.0.0",
                "schema_version": manifest["schema_version"],
                "analysis_version": manifest["analysis_version"],
                "release_id": manifest["release_id"],
                "dataset_sha256": manifest["source"]["sha256"],
            },
        )

    @router.get("/meta", response_model=schemas.MetaResponse)
    def meta(request: Request, analysis: Service, query: Annotated[NoQuery, Query()]):
        repository = analysis.repository
        return respond(
            request,
            schemas.MetaResponse,
            {
                "context": analysis.context("meta", Filters(), scope="full_dataset"),
                "source": analysis.manifest["source"],
                "metrics": [
                    c
                    for c in repository.get("dictionary.json")["columns"]
                    if c["analysis_eligible"]
                ],
                "coverage": repository.get("quality.json")["report"]["coverage"],
                "runtime_policy": analysis.manifest["runtime_policy"],
            },
        )

    @router.get("/dictionary", response_model=schemas.DictionaryResponse)
    def dictionary(request: Request, analysis: Service, query: Annotated[NoQuery, Query()]):
        return respond(
            request,
            schemas.DictionaryResponse,
            {
                "context": analysis.context("dictionary", Filters(), scope="full_dataset"),
                "columns": analysis.repository.get("dictionary.json")["columns"],
            },
        )

    @router.get("/teams", response_model=schemas.TeamsResponse)
    def teams(request: Request, analysis: Service, query: Annotated[NoQuery, Query()]):
        return respond(
            request,
            schemas.TeamsResponse,
            {
                "context": analysis.context("teams", Filters(), scope="full_dataset"),
                "teams": analysis.teams(),
            },
        )

    @router.get("/teams/{team_id}/summary", response_model=schemas.SummaryResponse)
    def summary(
        team_id: Annotated[str, PathParameter(pattern=r"^[0-9]+$")],
        request: Request,
        analysis: Service,
        query: Annotated[Filters, Query()],
    ):
        ensure_team(team_id, analysis)
        return respond(
            request,
            schemas.SummaryResponse,
            {
                "context": analysis.context("summary", query, [team_id]),
                **analysis.summary(team_id, query),
            },
        )

    @router.get("/distributions", response_model=schemas.DistributionResponse)
    def distributions(
        request: Request, analysis: Service, query: Annotated[DistributionQuery, Query()]
    ):
        ensure_team(query.team_id, analysis)
        return respond(
            request,
            schemas.DistributionResponse,
            {
                "context": analysis.context(
                    "distributions", query, [query.team_id], [query.metric]
                ),
                **analysis.distributions(query),
            },
        )

    @router.get("/comparisons", response_model=schemas.ComparisonResponse)
    def comparisons(
        request: Request, analysis: Service, query: Annotated[ComparisonQuery, Query()]
    ):
        return respond(
            request,
            schemas.ComparisonResponse,
            {
                "context": analysis.context("comparisons", query),
                **analysis.comparisons(query),
            },
        )

    @router.get("/anomalies", response_model=schemas.AnomalyResponse)
    def anomalies(request: Request, analysis: Service, query: Annotated[AnomalyQuery, Query()]):
        ensure_team(query.team_id, analysis)
        metrics = [query.metric] if query.metric else list(config.metrics)
        return respond(
            request,
            schemas.AnomalyResponse,
            {
                "context": analysis.context(
                    "anomalies",
                    query,
                    [query.team_id],
                    metrics,
                    scope="full_team_history_in_dataset",
                ),
                **analysis.anomalies(query),
            },
        )

    @router.get("/quality", response_model=schemas.QualityResponse)
    def quality(request: Request, analysis: Service, query: Annotated[NoQuery, Query()]):
        return respond(
            request,
            schemas.QualityResponse,
            {
                "context": analysis.context("quality", Filters(), scope="full_dataset"),
                "report": analysis.repository.get("quality.json")["report"],
            },
        )

    @router.get("/interpretations", response_model=schemas.InterpretationResponse)
    def interpretations(
        request: Request, analysis: Service, query: Annotated[InterpretationQuery, Query()]
    ):
        if query.team_id:
            ensure_team(query.team_id, analysis)
        content = analysis.repository.get("content.json")
        return respond(
            request,
            schemas.InterpretationResponse,
            {
                "context": analysis.context(
                    "interpretations",
                    query,
                    [query.team_id] if query.team_id else None,
                    [query.metric] if query.metric else None,
                ),
                "requested_context": query.context,
                "interpretation_status": content["interpretation_status"],
                "reason": "Interpretações analíticas serão redigidas e revisadas na etapa 9. "
                "Proveniência e metodologia abaixo descrevem o dataset completo e os métodos.",
                "interpretations": content["interpretations"],
                "provenance": content["provenance"],
                "methodology": content["methodology"],
                "missingness": content["missingness"],
            },
        )

    application.include_router(router)
    return application


app = create_app()
