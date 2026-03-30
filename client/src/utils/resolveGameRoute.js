export function resolveGameRoute({
  routeGameId,
  nickname,
  status,
  currentQuestion,
  lastRoundResults,
}) {
  if (!routeGameId) return null;

  if (!nickname) {
    return `/game/${routeGameId}/join`;
  }

  if (status === "waiting") {
    return `/game/${routeGameId}/lobby`;
  }

  if (status === "in-progress") {
    if (currentQuestion) {
      return `/game/${routeGameId}/play`;
    }
    return null;
  }

  if (status === "ended") {
    if (lastRoundResults) {
      return `/game/${routeGameId}/results`;
    }
    return null;
  }

  return null;
}
