import { useEffect } from "react";
import { useDispatch } from "react-redux";
import { useNavigate } from "react-router-dom";
import socket from "../socket";
import {
  setPlayerId,
  setPlayers,
  setStatus,
  setCurrentQuestion,
  setQuestionResult,
  updateScores,
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
      dispatch(setQuestionResult(payload));
      if (gameId) navigate(`/game/${gameId}/results`);
    }

    function onGameClosed() {
      dispatch(setStatus("idle"));
      navigate("/");
    }

    socket.on("connect", onConnect);
    socket.on("lobby:updated", onLobbyUpdated);
    socket.on("players:updated", onPlayersUpdated);
    socket.on("question:start", onQuestionStart);
    socket.on("question:end", onQuestionEnd);
    socket.on("game:end", onGameEnd);
    socket.on("game:closed", onGameClosed);

    // Sync playerId in case already connected
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
    };
  }, [dispatch, navigate, gameId]);
}
