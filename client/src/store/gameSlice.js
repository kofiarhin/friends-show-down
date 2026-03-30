import { createSlice } from "@reduxjs/toolkit";

const initialState = {
  gameId: null,
  playerId: null,
  nickname: null,
  isHost: false,
  hostToken: null,
  genre: null, // slug string | null — persists across restarts
  status: "idle", // idle | waiting | in-progress | ended
  players: [],
  currentQuestion: null, // { questionNumber, totalQuestions, question, timeLimit }
  lastQuestionResult: null, // { winnerId, winnerNickname, correctAnswer, scores }
  roundPhase: null, // "question_live" | "question_result" | "question_hype" | null
  phaseStartedAt: null,
  phaseEndsAt: null,
  hasAnswered: false,
  playState: "running", // "running" | "paused"
  endReason: null, // "completed" | "host_ended" | null
  lastRoundResults: null, // snapshot object or null
  startError: null, // error message from start:error event | null
  chatMessages: [],
  chatError: null,
  hostOffline: false, // only applies during "waiting" status (lobby phase)
};

const gameSlice = createSlice({
  name: "game",
  initialState,
  reducers: {
    setGame(state, action) {
      const { gameId, playerId, nickname, isHost, hostToken, genre } =
        action.payload;
      state.gameId = gameId;
      if (playerId !== undefined) state.playerId = playerId;
      if (nickname !== undefined) state.nickname = nickname;
      if (isHost !== undefined) state.isHost = isHost;
      if (hostToken !== undefined) state.hostToken = hostToken;
      if (genre !== undefined) state.genre = genre;
    },
    setGenre(state, action) {
      state.genre = action.payload;
    },
    setStartError(state, action) {
      state.startError = action.payload;
    },
    setPlayerId(state, action) {
      state.playerId = action.payload;
    },
    setStatus(state, action) {
      state.status = action.payload;
    },
    setPlayers(state, action) {
      state.players = action.payload;
    },
    addPlayer(state, action) {
      const exists = state.players.find(
        (p) => p.playerId === action.payload.playerId,
      );
      if (!exists) state.players.push(action.payload);
    },
    updateScores(state, action) {
      state.players = action.payload;
    },
    setCurrentQuestion(state, action) {
      state.currentQuestion = action.payload;
      state.hasAnswered = false;
      state.lastQuestionResult = null;
      state.roundPhase = action.payload?.roundPhase ?? "question_live";
      state.phaseStartedAt = action.payload?.phaseStartedAt ?? null;
      state.phaseEndsAt = null;
      state.playState = "running";
      state.startError = null;
    },
    setQuestionResult(state, action) {
      const result = action.payload ? { ...action.payload } : null;
      if (result && !result.scores && state.lastQuestionResult?.scores) {
        result.scores = state.lastQuestionResult.scores;
      }
      state.lastQuestionResult = result;
      state.roundPhase = result?.roundPhase ?? "question_result";
      state.phaseStartedAt = result?.phaseStartedAt ?? null;
      state.phaseEndsAt = null;
      if (result?.scores) {
        state.players = result.scores;
      }
    },
    setRoundPhase(state, action) {
      const {
        roundPhase,
        phaseStartedAt = null,
        phaseEndsAt = null,
      } = action.payload;
      state.roundPhase = roundPhase;
      state.phaseStartedAt = phaseStartedAt;
      state.phaseEndsAt = phaseEndsAt;
    },
    setHasAnswered(state, action) {
      state.hasAnswered = action.payload;
    },
    setPlayState(state, action) {
      state.playState = action.payload;
    },
    setEndReason(state, action) {
      state.endReason = action.payload;
    },
    setLastRoundResults(state, action) {
      state.lastRoundResults = action.payload;
    },
    addChatMessage(state, action) {
      state.chatMessages.push(action.payload);
      if (state.chatMessages.length > 50) {
        state.chatMessages.shift();
      }
    },
    setChatMessages(state, action) {
      state.chatMessages = action.payload || [];
    },
    setChatError(state, action) {
      state.chatError = action.payload;
    },
    clearChatMessages(state) {
      state.chatMessages = [];
    },
    clearChatError(state) {
      state.chatError = null;
    },
    setHostOffline(state) {
      state.hostOffline = true;
    },
    clearHostOffline(state) {
      state.hostOffline = false;
    },
    resumeQuestion(state, action) {
      // action.payload = timeLeft in seconds
      if (state.currentQuestion) {
        state.currentQuestion = {
          ...state.currentQuestion,
          timeLimit: action.payload,
        };
      }
      state.playState = "running";
      state.roundPhase = "question_live";
    },
    resetRound(state) {
      return {
        ...initialState,
        gameId: state.gameId,
        playerId: state.playerId,
        nickname: state.nickname,
        isHost: state.isHost,
        hostToken: state.hostToken,
        genre: state.genre,
        status: "waiting",
      };
    },
    resetGame() {
      return initialState;
    },
  },
});

export const {
  setGame,
  setPlayerId,
  setStatus,
  setPlayers,
  addPlayer,
  updateScores,
  setCurrentQuestion,
  setQuestionResult,
  setRoundPhase,
  setHasAnswered,
  setPlayState,
  setEndReason,
  setLastRoundResults,
  addChatMessage,
  setChatMessages,
  setChatError,
  clearChatMessages,
  clearChatError,
  resumeQuestion,
  resetRound,
  resetGame,
  setGenre,
  setStartError,
  setHostOffline,
  clearHostOffline,
} = gameSlice.actions;

export default gameSlice.reducer;
