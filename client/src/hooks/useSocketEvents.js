import { useEffect } from "react";
import { useDispatch } from "react-redux";
import { useNavigate } from "react-router-dom";
import { socket } from "../socket";
import {
  setPlayerId,
  setPlayers,
  setStatus,
  setCurrentQuestion,
  setQuestionResult,
  updateScores,
  setPlayState,
  setEndReason,
  setLastRoundResults,
  resumeQuestion,
  resetRound,
  resetGame,
} from "../store/gameSlice";

export function useSocketEvents(gameId) {
  const dispatch = useDispatch();
  const navigate = useNavigate();

  useEffect(() => {
    function onConnect() {
      dispatch(setPlayerId(socket.id));
    }

    function onLobbyUpdated({ players }) {
      dispatch(setPlayers(players));
    }

    function onPlayersUpdated({ players }) {
      dispatch(updateScores(players));
    }

    function onQuestionStart(payload) {
      dispatch(setStatus("in-progress"));
      dispatch(setCurrentQuestion(payload));
      if (gameId) navigate(`/game/${gameId}/play`);
    }

    function onQuestionEnd(payload) {
      dispatch(setQuestionResult(payload));
    }

    function onGameEnd(payload) {
      dispatch(setStatus("ended"));
      dispatch(setEndReason(payload.endReason ?? "completed"));
      dispatch(setLastRoundResults(payload));
      dispatch(setQuestionResult(payload));
      if (gameId) navigate(`/game/${gameId}/results`);
    }

    function onGameClosed() {
      dispatch(resetGame());
      navigate("/");
    }

    function onGamePaused() {
      dispatch(setPlayState("paused"));
    }

    function onGameResumed({ remainingTimeMs }) {
      dispatch(resumeQuestion(Math.ceil(remainingTimeMs / 1000)));
    }

    function onGameRestarted({ players }) {
      dispatch(resetRound());
      dispatch(setPlayers(players));
      if (gameId) navigate(`/game/${gameId}/lobby`);
    }

    socket.on("connect", onConnect);
    socket.on("lobby:updated", onLobbyUpdated);
    socket.on("players:updated", onPlayersUpdated);
    socket.on("question:start", onQuestionStart);
    socket.on("question:end", onQuestionEnd);
    socket.on("game:end", onGameEnd);
    socket.on("game:closed", onGameClosed);
    socket.on("game:paused", onGamePaused);
    socket.on("game:resumed", onGameResumed);
    socket.on("game:restarted", onGameRestarted);

    if (socket.connected) {
      dispatch(setPlayerId(socket.id));
    }

    return () => {
      socket.off("connect", onConnect);
      socket.off("lobby:updated", onLobbyUpdated);
      socket.off("players:updated", onPlayersUpdated);
      socket.off("question:start", onQuestionStart);
      socket.off("question:end", onQuestionEnd);
      socket.off("game:end", onGameEnd);
      socket.off("game:closed", onGameClosed);
      socket.off("game:paused", onGamePaused);
      socket.off("game:resumed", onGameResumed);
      socket.off("game:restarted", onGameRestarted);
    };
  }, [dispatch, navigate, gameId]);
}
