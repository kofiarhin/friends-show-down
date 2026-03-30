import { useEffect, useRef } from "react";
import { useDispatch, useSelector } from "react-redux";
import { useNavigate } from "react-router-dom";
import { socket } from "../socket";
import {
  setPlayerId,
  setPlayers,
  setStatus,
  setCurrentQuestion,
  setQuestionResult,
  setRoundPhase,
  updateScores,
  setPlayState,
  setEndReason,
  setLastRoundResults,
  addChatMessage,
  setChatMessages,
  setChatError,
  resumeQuestion,
  resetRound,
  resetGame,
  setGenre,
  setStartError,
  setHostOffline,
  clearHostOffline,
} from "../store/gameSlice";

export function useSocketEvents(gameId) {
  const dispatch = useDispatch();
  const navigate = useNavigate();
  const { nickname, isHost, hostToken } = useSelector((s) => s.game);

  const nicknameRef = useRef(nickname);
  const isHostRef = useRef(isHost);
  const hostTokenRef = useRef(hostToken);

  useEffect(() => {
    nicknameRef.current = nickname;
  }, [nickname]);
  useEffect(() => {
    isHostRef.current = isHost;
  }, [isHost]);
  useEffect(() => {
    hostTokenRef.current = hostToken;
  }, [hostToken]);

  useEffect(() => {
    function emitJoinIfPossible() {
      if (!gameId || !nicknameRef.current) return;

      const payload = { gameId, nickname: nicknameRef.current };
      if (isHostRef.current && hostTokenRef.current) {
        payload.hostToken = hostTokenRef.current;
      }
      socket.emit("game:join", payload);
    }

    function onConnect() {
      dispatch(setPlayerId(socket.id));
      emitJoinIfPossible();
    }

    function onLobbyUpdated({ players, genre }) {
      dispatch(setPlayers(players));
      dispatch(setStatus("waiting"));
      if (genre !== undefined) dispatch(setGenre(genre));
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

    function onRoundPhase(payload) {
      dispatch(
        setRoundPhase({
          roundPhase: payload.roundPhase,
          phaseStartedAt: payload.phaseStartedAt,
          phaseEndsAt: payload.phaseEndsAt,
        }),
      );
      if (payload.lastResult) {
        dispatch(
          setQuestionResult({
            winnerId: payload.lastResult.winnerId ?? null,
            winnerNickname: payload.lastResult.winner ?? null,
            correctAnswer: payload.lastResult.correctAnswer,
            roundPhase: "question_hype",
            phaseStartedAt: payload.phaseStartedAt,
          }),
        );
      }
    }

    function onChatMessage(payload) {
      dispatch(addChatMessage(payload));
    }

    function onChatHistory(payload) {
      if (payload?.messages) {
        dispatch(setChatMessages(payload.messages));
      }
    }

    function onChatError(payload) {
      dispatch(setChatError(payload?.message ?? "Unable to send message."));
    }

    function onGameEnd(payload) {
      dispatch(setStatus("ended"));
      dispatch(setEndReason(payload.endReason ?? "completed"));
      dispatch(setLastRoundResults(payload));
      dispatch(setQuestionResult(payload));
      dispatch(clearHostOffline());
      if (payload.genre !== undefined) dispatch(setGenre(payload.genre));
      if (gameId) navigate(`/game/${gameId}/results`);
    }

    function onHostOffline() {
      dispatch(setHostOffline());
    }

    function onHostReconnected({ players } = {}) {
      dispatch(clearHostOffline());
      if (players) dispatch(setPlayers(players));
    }

    function onGameClosed() {
      dispatch(resetGame());
      navigate("/");
    }

    function onGamePaused() {
      dispatch(setPlayState("paused"));
    }

    function onGameResumed({ remainingTimeMs }) {
      dispatch(setPlayState("running"));
      dispatch(resumeQuestion(Math.ceil(remainingTimeMs / 1000)));
    }

    function onGameRestarted({ players, genre }) {
      dispatch(resetRound());
      if (genre !== undefined) dispatch(setGenre(genre));
      dispatch(setPlayers(players));
      if (gameId) navigate(`/game/${gameId}/lobby`);
    }

    function onStartError({ message }) {
      dispatch(setStartError(message));
    }

    function onGenreUpdated({ genre }) {
      dispatch(setGenre(genre));
    }

    socket.on("connect", onConnect);
    socket.on("host:offline", onHostOffline);
    socket.on("host:reconnected", onHostReconnected);
    socket.on("lobby:updated", onLobbyUpdated);
    socket.on("players:updated", onPlayersUpdated);
    socket.on("question:start", onQuestionStart);
    socket.on("question:end", onQuestionEnd);
    socket.on("round:phase", onRoundPhase);
    socket.on("chat:message", onChatMessage);
    socket.on("chat:history", onChatHistory);
    socket.on("chat:error", onChatError);
    socket.on("game:end", onGameEnd);
    socket.on("game:closed", onGameClosed);
    socket.on("game:paused", onGamePaused);
    socket.on("game:resumed", onGameResumed);
    socket.on("game:restarted", onGameRestarted);
    socket.on("start:error", onStartError);
    socket.on("genre:updated", onGenreUpdated);

    if (socket.connected) {
      dispatch(setPlayerId(socket.id));
      emitJoinIfPossible();
    }

    return () => {
      socket.off("connect", onConnect);
      socket.off("host:offline", onHostOffline);
      socket.off("host:reconnected", onHostReconnected);
      socket.off("lobby:updated", onLobbyUpdated);
      socket.off("players:updated", onPlayersUpdated);
      socket.off("question:start", onQuestionStart);
      socket.off("question:end", onQuestionEnd);
      socket.off("round:phase", onRoundPhase);
      socket.off("chat:message", onChatMessage);
      socket.off("chat:history", onChatHistory);
      socket.off("chat:error", onChatError);
      socket.off("game:end", onGameEnd);
      socket.off("game:closed", onGameClosed);
      socket.off("game:paused", onGamePaused);
      socket.off("game:resumed", onGameResumed);
      socket.off("game:restarted", onGameRestarted);
      socket.off("start:error", onStartError);
      socket.off("genre:updated", onGenreUpdated);
    };
  }, [dispatch, navigate, gameId]);
}
