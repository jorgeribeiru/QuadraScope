"""Dicionário executável: nomes, tipos, unidades e seleção das variáveis."""

from dataclasses import asdict, dataclass
from types import MappingProxyType
from typing import Literal

from backend.app.config import settings


@dataclass(frozen=True)
class ColumnSpec:
    original: str
    canonical: str
    label: str
    kind: Literal["string", "identifier", "integer", "float", "boolean", "date"]
    unit: str
    role: Literal["context", "auxiliary", "primary"]
    domain: str

    @property
    def analysis_eligible(self) -> bool:
        return self.role == "primary"

    @property
    def exclusion_reason(self) -> str | None:
        if self.analysis_eligible:
            return None
        if self.role == "auxiliary":
            return "Fora do vetor obrigatório; preservado para contexto e análises futuras."
        return "Identificação ou contexto pós-jogo, sem uso no vetor estatístico escolhido."

    def to_dict(self) -> dict:
        return {
            **asdict(self),
            "analysis_eligible": self.analysis_eligible,
            "exclusion_reason": self.exclusion_reason,
        }


COLUMNS = (
    ColumnSpec(
        "Team_ID",
        "team_id",
        "Time: identificador",
        "identifier",
        "identificador",
        "context",
        "Dígitos como texto",
    ),
    ColumnSpec(
        "Game_ID",
        "game_id",
        "Partida: identificador",
        "identifier",
        "identificador",
        "context",
        "Dígitos como texto",
    ),
    ColumnSpec(
        "GAME_DATE", "game_date", "Data da partida", "date", "data civil", "context", "YYYY-MM-DD"
    ),
    ColumnSpec(
        "MATCHUP",
        "matchup",
        "Confronto",
        "string",
        "texto",
        "context",
        "Texto sem espaços externos",
    ),
    ColumnSpec("WL", "won", "Vitória", "boolean", "vitória/derrota", "context", "0 ou 1 na origem"),
    ColumnSpec(
        "W",
        "cumulative_wins",
        "Vitórias acumuladas",
        "integer",
        "vitórias",
        "context",
        "Inteiro não negativo",
    ),
    ColumnSpec(
        "L",
        "cumulative_losses",
        "Derrotas acumuladas",
        "integer",
        "derrotas",
        "context",
        "Inteiro não negativo",
    ),
    ColumnSpec(
        "W_PCT",
        "cumulative_win_rate",
        "Aproveitamento acumulado",
        "float",
        "fração",
        "context",
        "[0,1]",
    ),
    ColumnSpec(
        "MIN",
        "team_minutes",
        "Minutos agregados",
        "integer",
        "minutos de jogadores",
        "context",
        "Inteiro não negativo",
    ),
    ColumnSpec(
        "FGM",
        "field_goals_made",
        "Cestas de quadra",
        "integer",
        "cestas/jogo",
        "auxiliary",
        "Inteiro não negativo",
    ),
    ColumnSpec(
        "FGA",
        "field_goals_attempted",
        "Arremessos de quadra",
        "integer",
        "tentativas/jogo",
        "auxiliary",
        "Inteiro não negativo",
    ),
    ColumnSpec(
        "FG_PCT",
        "field_goal_rate",
        "Aproveitamento de quadra",
        "float",
        "fração",
        "auxiliary",
        "[0,1]",
    ),
    ColumnSpec(
        "FG3M",
        "three_pointers_made",
        "Cestas de três",
        "integer",
        "cestas/jogo",
        "primary",
        "Inteiro não negativo",
    ),
    ColumnSpec(
        "FG3A",
        "three_pointers_attempted",
        "Arremessos de três",
        "integer",
        "tentativas/jogo",
        "auxiliary",
        "Inteiro não negativo",
    ),
    ColumnSpec(
        "FG3_PCT",
        "three_point_rate",
        "Aproveitamento de três",
        "float",
        "fração",
        "auxiliary",
        "[0,1]",
    ),
    ColumnSpec(
        "FTM",
        "free_throws_made",
        "Lances livres convertidos",
        "integer",
        "lances/jogo",
        "auxiliary",
        "Inteiro não negativo",
    ),
    ColumnSpec(
        "FTA",
        "free_throws_attempted",
        "Lances livres tentados",
        "integer",
        "tentativas/jogo",
        "auxiliary",
        "Inteiro não negativo",
    ),
    ColumnSpec(
        "FT_PCT",
        "free_throw_rate",
        "Aproveitamento de lance livre",
        "float",
        "fração",
        "auxiliary",
        "[0,1]",
    ),
    ColumnSpec(
        "OREB",
        "offensive_rebounds",
        "Rebotes ofensivos",
        "integer",
        "rebotes/jogo",
        "auxiliary",
        "Inteiro não negativo",
    ),
    ColumnSpec(
        "DREB",
        "defensive_rebounds",
        "Rebotes defensivos",
        "integer",
        "rebotes/jogo",
        "auxiliary",
        "Inteiro não negativo",
    ),
    ColumnSpec(
        "REB", "rebounds", "Rebotes", "integer", "rebotes/jogo", "primary", "Inteiro não negativo"
    ),
    ColumnSpec(
        "AST",
        "assists",
        "Assistências",
        "integer",
        "assistências/jogo",
        "primary",
        "Inteiro não negativo",
    ),
    ColumnSpec(
        "STL", "steals", "Roubos", "integer", "roubos/jogo", "primary", "Inteiro não negativo"
    ),
    ColumnSpec(
        "BLK", "blocks", "Tocos", "integer", "tocos/jogo", "primary", "Inteiro não negativo"
    ),
    ColumnSpec(
        "TOV",
        "turnovers",
        "Desperdícios de posse",
        "integer",
        "desperdícios/jogo",
        "auxiliary",
        "Inteiro não negativo",
    ),
    ColumnSpec(
        "PF",
        "personal_fouls",
        "Faltas pessoais",
        "integer",
        "faltas/jogo",
        "primary",
        "Inteiro não negativo",
    ),
    ColumnSpec(
        "PTS", "points", "Pontos", "integer", "pontos/jogo", "primary", "Inteiro não negativo"
    ),
    ColumnSpec(
        "TEAM_NAME",
        "team_name",
        "Nome do time",
        "string",
        "texto",
        "context",
        "Texto sem espaços externos",
    ),
)

COLUMN_BY_ORIGINAL = MappingProxyType({column.original: column for column in COLUMNS})


def get_metric(code: str) -> ColumnSpec:
    """Resolve somente as sete métricas públicas elegíveis."""
    column = COLUMN_BY_ORIGINAL.get(code)
    if column is None or not column.analysis_eligible:
        raise ValueError(f"Métrica fora do escopo analítico: {code!r}.")
    return column


def feature_columns(codes: tuple[str, ...] = settings.metrics) -> tuple[str, ...]:
    return tuple(get_metric(code).canonical for code in codes)
