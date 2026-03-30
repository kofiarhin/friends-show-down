import { useEffect } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { useSelector } from "react-redux";
import { resolveGameRoute } from "../utils/resolveGameRoute";

export function useRouteGuard(gameId) {
  const navigate = useNavigate();
  const location = useLocation();
  const { status, nickname, currentQuestion, lastRoundResults, isHydrated } =
    useSelector((state) => ({
      status: state.game.status,
      nickname: state.game.nickname,
      currentQuestion: state.game.currentQuestion,
      lastRoundResults: state.game.lastRoundResults,
      isHydrated: state.game.isHydrated,
    }));

  useEffect(() => {
    const resolvedRoute = resolveGameRoute({
      routeGameId: gameId,
      status,
      nickname,
      currentQuestion,
      lastRoundResults,
      isHydrated,
    });

    if (!resolvedRoute) return;
    if (location.pathname === resolvedRoute) return;

    navigate(resolvedRoute, { replace: true });
  }, [
    gameId,
    status,
    nickname,
    currentQuestion,
    lastRoundResults,
    isHydrated,
    location.pathname,
    navigate,
  ]);
}
