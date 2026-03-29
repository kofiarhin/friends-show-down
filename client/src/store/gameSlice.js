import { createSlice } from "@reduxjs/toolkit";

const initialState = {
  gameId: null,
  playerId: null,
  nickname: null,
  isHost: false,
  genre: null,               // slug string | null — persists across restarts
  status: "idle", // idle | waiting | in-progress | ended
  players: [],
  currentQuestion: null, // { questionNumber, totalQuestions, question, timeLimit }
  lastQuestionResult: null, // { winnerId, winnerNickname, correctAnswer, scores }
  hasAnswered: false,
  playState: "running",      // "running" | "paused"
  endReason: null,           // "completed" | "host_ended" | null
  lastRoundResults: null,    // snapshot object or null
  startError: null,          // error message from start:error event | null
};

const gameSlice = createSlice({
  name: "game",
  initialState,
  reducers: {
    setGame(state, action) {
      const { gameId, playerId, nickname, isHost, genre } = action.payload;
      state.gameId = gameId;
      if (playerId !== undefined) state.playerId = playerId;
      if (nickname !== undefined) state.nickname = nickname;
      if (isHost !== undefined) state.isHost = isHost;
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
        (p) => p.playerId === action.payload.playerId
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
      state.playState = "running";
      state.startError = null;
    },
    setQuestionResult(state, action) {
      state.lastQuestionResult = action.payload;
      if (action.payload?.scores) {
        state.players = action.payload.scores;
      }
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
    resumeQuestion(state, action) {
      // action.payload = timeLeft in seconds
      if (state.currentQuestion) {
        state.currentQuestion = { ...state.currentQuestion, timeLimit: action.payload };
      }
      state.playState = "running";
    },
    resetRound(state) {
      return {
        ...initialState,
        gameId: state.gameId,
        playerId: state.playerId,
        nickname: state.nickname,
        isHost: state.isHost,
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
  setHasAnswered,
  setPlayState,
  setEndReason,
  setLastRoundResults,
  resumeQuestion,
  resetRound,
  resetGame,
  setGenre,
  setStartError,
} = gameSlice.actions;

export default gameSlice.reducer;
