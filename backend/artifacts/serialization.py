"""JSON canônico, hashing e parsing sem chaves repetidas ou números não finitos."""

import hashlib
import json
import math
from datetime import date
from pathlib import Path


class ArtifactError(ValueError):
    """Conjunto ausente, incompatível, adulterado ou cientificamente inconsistente."""


def _date_json(value):
    if isinstance(value, date):
        return value.isoformat()
    raise TypeError(f"Tipo não serializável: {type(value).__name__}")


def canonical_bytes(data) -> bytes:
    return (
        json.dumps(
            data,
            ensure_ascii=False,
            sort_keys=True,
            separators=(",", ":"),
            allow_nan=False,
            default=_date_json,
        )
        + "\n"
    ).encode("utf-8")


def digest(data: bytes) -> str:
    return hashlib.sha256(data).hexdigest()


def assert_finite_json(value):
    if isinstance(value, float) and not math.isfinite(value):
        raise ArtifactError("JSON contém número não finito.")
    if isinstance(value, dict):
        for child in value.values():
            assert_finite_json(child)
    elif isinstance(value, list):
        for child in value:
            assert_finite_json(child)


def _pairs(items):
    data = {}
    for key, value in items:
        if key in data:
            raise ArtifactError(f"Chave JSON repetida: {key}.")
        data[key] = value
    return data


def read_json(path: Path):
    def invalid_constant(value):
        raise ArtifactError(f"Constante JSON inválida: {value}.")

    try:
        value = json.loads(
            path.read_bytes(), object_pairs_hook=_pairs, parse_constant=invalid_constant
        )
    except (OSError, ValueError) as error:
        raise ArtifactError(f"Artefato JSON inválido/ausente: {path.name}: {error}") from error
    assert_finite_json(value)
    return value


def validate_model(model, data) -> dict:
    # Modo JSON permite datas ISO com validação estrita, sem coerção de strings numéricas.
    try:
        validated = model.model_validate_json(canonical_bytes(data), strict=True)
    except (ValueError, TypeError) as error:
        raise ArtifactError(f"Contrato {model.__name__} inválido: {error}") from error
    return validated.model_dump(mode="json", by_alias=True)
