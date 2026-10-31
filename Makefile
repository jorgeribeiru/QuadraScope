UV ?= uv
NPM ?= npm

.PHONY: help install run ci delivery setup check-env lint format test check export-requirements data-normalize data-quality data-describe data-anomalies data-build data-validate data-reproduce data-package-runtime api-serve api-export api-contracts web-setup web-dev web-build web-check web-e2e dev deploy-prepare report-audit

help:
	@echo "install              Instala Python e frontend pelos locks (primeira execução)"
	@echo "run                  Gera/valida dados e inicia API + frontend; Ctrl+C encerra"
	@echo "ci                   Executa os checks de integração contínua"
	@echo "delivery             Gera ZIP do código atual e manifesto de hashes"
	@echo "report-audit         Confere medidas e partidas diretamente no CSV original"
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
	@echo "data-build           Executa pipeline integral, valida e publica release local"
	@echo "data-validate        Verifica o release publicado, hashes e consistências"
	@echo "data-reproduce       Compara dois builds independentes sem promover ponteiro"
	@echo "data-package-runtime Exporta pacote JSON para a API"
	@echo "api-serve            Inicia FastAPI local em 127.0.0.1:8000"
	@echo "api-export           Exporta o contrato OpenAPI sem carregar artefatos"
	@echo "api-contracts        Gera e confere tipos TypeScript a partir do OpenAPI"

	@echo "web-setup            Instala dependências frontend pelo lock (Node 24)"
	@echo "web-dev              Inicia Vite em 127.0.0.1:5173"
	@echo "web-build            Compila TypeScript e gera frontend/dist"
	@echo "web-check            ESLint, Prettier, Vitest e build React"
	@echo "web-e2e              Testa frontend e API reais no navegador"
	@echo "dev                  Inicia API e frontend juntos; encerra com Ctrl+C"
	@echo "deploy-prepare       Empacota runtime Python, dados e SPA em .deployment"

setup:
	$(UV) sync --locked

check-env:
	$(UV) run --locked python -m backend.scripts.check_environment

lint:
	$(UV) run --locked ruff check backend deployment
	$(UV) run --locked ruff format --check backend deployment

format:
	$(UV) run --locked ruff format backend deployment

test:
	$(UV) run --locked pytest

check: check-env lint test

export-requirements:
	$(UV) export --locked --no-default-groups --group pipeline --no-emit-project --format requirements-txt --output-file requirements.txt > /dev/null
	$(UV) export --locked --no-default-groups --no-emit-project --format requirements-txt --output-file requirements-runtime.txt > /dev/null

data-normalize:
	$(UV) run --locked python -m backend.scripts.normalize_data

data-quality:
	$(UV) run --locked python -m backend.scripts.audit_data

data-describe:
	$(UV) run --locked python -m backend.scripts.describe_data

data-anomalies:
	$(UV) run --locked python -m backend.scripts.detect_anomalies

data-build:
	$(UV) run --locked python -m backend.scripts.build_data build

data-validate:
	$(UV) run --locked python -m backend.scripts.build_data validate

data-reproduce:
	$(UV) run --locked python -m backend.scripts.build_data reproduce

data-package-runtime:
	$(UV) run --locked python -m backend.scripts.build_data package-runtime

api-serve:
	$(UV) run --locked uvicorn backend.app.main:app --host 127.0.0.1 --port 8000

api-export:
	$(UV) run --locked python -m backend.scripts.export_api

api-contracts: api-export
	$(NPM) ci --ignore-scripts --prefix tools/contracts
	$(NPM) run generate --prefix tools/contracts
	$(NPM) run check --prefix tools/contracts

web-setup:
	$(NPM) ci --prefix frontend

web-dev:
	$(NPM) run dev --prefix frontend

web-build:
	$(NPM) run build --prefix frontend

web-check:
	$(NPM) run check --prefix frontend

web-e2e: web-build
	$(NPM) run test:e2e --prefix frontend

dev:
	$(UV) run --locked python -m backend.scripts.develop

deploy-prepare:
	$(UV) run --locked python -m backend.scripts.prepare_deployment

report-audit:
	$(UV) run --locked python -m backend.scripts.verify_report

install:
	$(MAKE) setup
	$(MAKE) web-setup

run:
	$(MAKE) data-build
	$(MAKE) dev

ci:
	$(MAKE) check
	$(MAKE) data-build
	$(MAKE) data-validate
	$(MAKE) report-audit
	$(MAKE) data-reproduce
	$(MAKE) export-requirements
	git diff --exit-code -- requirements.txt requirements-runtime.txt
	$(MAKE) api-contracts
	git diff --exit-code -- docs/api/openapi.json frontend/src/generated/api.ts
	$(MAKE) web-check
	$(MAKE) deploy-prepare

delivery:
	$(UV) run --locked python -m backend.scripts.prepare_delivery
