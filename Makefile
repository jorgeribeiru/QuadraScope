UV ?= uv

.PHONY: help setup check-env lint format test check export-requirements data-normalize data-quality data-describe data-anomalies data-build

help:
	@echo "setup                Instala Python 3.12 e sincroniza .venv pelo lock"
	@echo "check-env            Verifica ambiente, dependências e caminhos"
	@echo "lint                 Executa Ruff e confere formatação"
	@echo "format               Aplica a formatação do Ruff"
	@echo "test                 Executa os testes existentes"
	@echo "check                Executa ambiente, lint e testes"
	@echo "export-requirements  Exporta dependências de execução com hashes"
	@echo "data-normalize       Normaliza CSV e gera intermediários da etapa 2"
	@echo "data-quality         Audita qualidade e libera enriquecimento se aprovado"
	@echo "data-describe        Calcula descritivas, boxplots e distribuições comparáveis"
	@echo "data-anomalies       Executa sete detectores e valida sensibilidade/parâmetros"
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

data-normalize:
	$(UV) run --locked python -m backend.scripts.normalize_data

data-quality:
	$(UV) run --locked python -m backend.scripts.audit_data

data-describe:
	$(UV) run --locked python -m backend.scripts.describe_data

data-anomalies:
	$(UV) run --locked python -m backend.scripts.detect_anomalies

data-build:
	@echo "Build de dados ainda não implementado (etapas 2–6). Nenhum artefato foi gerado." >&2
	@exit 2
