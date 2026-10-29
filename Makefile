UV ?= uv

.PHONY: help setup check-env lint format test check export-requirements data-build

help:
	@echo "setup                Instala Python 3.12 e sincroniza .venv pelo lock"
	@echo "check-env            Verifica ambiente, dependências e caminhos"
	@echo "lint                 Executa Ruff e confere formatação"
	@echo "format               Aplica a formatação do Ruff"
	@echo "test                 Executa os testes existentes"
	@echo "check                Executa ambiente, lint e testes"
	@echo "export-requirements  Exporta dependências de execução com hashes"
	@echo "data-build           Indisponível: pipeline previsto para etapas 2–6"

setup:
	$(UV) sync --locked

check-env:
	$(UV) run --locked python -m backend.scripts.check_environment

lint:
	$(UV) run --locked ruff check backend
	$(UV) run --locked ruff format --check backend

format:
	$(UV) run --locked ruff format backend

test:
	$(UV) run --locked pytest

check: check-env lint test

export-requirements:
	$(UV) export --locked --no-dev --no-emit-project --format requirements-txt --output-file requirements.txt > /dev/null

data-build:
	@echo "Build de dados ainda não implementado (etapas 2–6). Nenhum artefato foi gerado." >&2
	@exit 2
