"""A coleta não confunde resposta quente com primeira requisição nem mistura releases."""

import io
import json
from unittest.mock import MagicMock

import pytest

from backend.scripts.benchmark_cloud import measure

pytestmark = pytest.mark.api


@pytest.fixture
def remote(monkeypatch):
    response = MagicMock()
    response.headers = {
        "x-quadrascope-worker": "a" * 32,
        "x-quadrascope-first-request": "0",
        "server-timing": "qs_import;dur=5000, qs_startup;dur=600, qs_app;dur=10",
    }

    def fetch(request, timeout):
        response.__enter__.return_value = response
        body = {"release_id": "release-a", "result": {"reference_n": 74, "display_n": 35}}
        response.read = io.BytesIO(json.dumps(body).encode()).read
        return response

    monkeypatch.setattr("urllib.request.urlopen", fetch)
    return response


def test_warm_responses_retain_initialization_without_claiming_a_cold_http_request(remote):
    report = measure("https://example.test", "release-a", "dpl_test", samples=2)
    assert report["status"] == "passed"
    assert report["first_http_observed"] is False
    assert report["platform_provisioning_isolated"] is False
    assert report["first_requests"] == []
    assert report["workers"]["a" * 32]["application_initialization_ms"] == 5600
    assert len(report["records"]) == 8


def test_mismatching_release_stops_measurement(remote):
    with pytest.raises(ValueError, match="Release divergente"):
        measure("https://example.test", "release-b", "dpl_test", samples=2)


@pytest.mark.parametrize("header", ["server-timing", "x-quadrascope-worker"])
def test_missing_instrumentation_is_not_reported_as_success(remote, header):
    del remote.headers[header]
    with pytest.raises(ValueError, match="Instrumentação ausente"):
        measure("https://example.test", "release-a", "dpl_test", samples=2)
