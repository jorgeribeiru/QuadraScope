"""Configuração compartilhada pelo futuro pipeline e pela API.

Os caminhos são resolvidos pelo repositório, nunca pelo diretório de execução.
Importar este módulo não lê o CSV, não cria pastas e não escreve artefatos.
"""

from dataclasses import dataclass
from pathlib import Path

PROJECT_ROOT = Path(__file__).resolve().parents[2]


@dataclass(frozen=True)
class Settings:
    """Valores imutáveis de escopo e identificação dos artefatos."""

    project_root: Path = PROJECT_ROOT
    team_ids: tuple[str, ...] = ("1610612737", "1610612745")
    metrics: tuple[str, ...] = ("PTS", "REB", "AST", "STL", "BLK", "PF", "FG3M")
    schema_version: str = "1.0.0"
    analysis_version: str = "1.0.0"
    expected_dataset_sha256: str = (
        "fa56bf638ef18be972a88850719043953e615bf39339671a8daa007ba08811b6"
    )

    @property
    def raw_data_dir(self) -> Path:
        return self.project_root / "data" / "raw"

    @property
    def processed_data_dir(self) -> Path:
        return self.project_root / "data" / "processed"

    @property
    def dataset_path(self) -> Path:
        return self.raw_data_dir / "stats_times_regular_final.csv"

    @property
    def ingestion_dir(self) -> Path:
        return self.processed_data_dir / "ingestion"

    @property
    def quality_dir(self) -> Path:
        return self.processed_data_dir / "quality"

    @property
    def descriptive_dir(self) -> Path:
        return self.processed_data_dir / "descriptive"

    @property
    def anomaly_dir(self) -> Path:
        return self.processed_data_dir / "anomalies"

    @property
    def releases_dir(self) -> Path:
        return self.processed_data_dir / "releases"

    @property
    def current_pointer_path(self) -> Path:
        return self.processed_data_dir / "current.json"

    @property
    def runtime_package_dir(self) -> Path:
        return self.processed_data_dir / "runtime"


settings = Settings()
