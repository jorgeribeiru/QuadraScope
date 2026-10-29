import type { components, paths } from "../../frontend/src/generated/api";

type Summary = paths["/api/v1/teams/{team_id}/summary"]["get"]["responses"][200]["content"]["application/json"];
type Failure = paths["/api/v1/quality"]["get"]["responses"][503]["content"]["application/json"];
type Metric = components["schemas"]["Description"]["metric"];

const metric: Metric = "PTS";
// @ts-expect-error MIN não pertence às sete variáveis públicas.
const excluded: Metric = "MIN";

function observations(response: Summary): number {
  return response.context.n_by_team["1610612737"];
}

function errorCode(response: Failure): string {
  return response.error.code;
}

void [metric, excluded, observations, errorCode];
