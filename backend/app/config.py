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

    @property
    def raw_data_dir(self) -> Path:
        return self.project_root / "data" / "raw"

    @property
    def processed_data_dir(self) -> Path:
        return self.project_root / "data" / "processed"

    @property
    def dataset_path(self) -> Path:
        return self.raw_data_dir / "stats_times_regular_final.csv"


settings = Settings()
