import { createSlice } from "@reduxjs/toolkit";

const initialState = {
  gameId: null,
  playerId: null,
  nickname: null,
  isHost: false,
  status: "idle", // idle | waiting | in-progress | ended
  players: [],
  currentQuestion: null, // { questionNumber, totalQuestions, question, timeLeft }
  lastQuestionResult: null, // { winnerId, winnerNickname, correctAnswer, scores }
  hasAnswered: false,
};

const gameSlice = createSlice({
  name: "game",
  initialState,
  reducers: {
    setGame(state, action) {
      const { gameId, playerId, nickname, isHost } = action.payload;
      state.gameId = gameId;
      if (playerId !== undefined) state.playerId = playerId;
      if (nickname !== undefined) state.nickname = nickname;
      if (isHost !== undefined) state.isHost = isHost;
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
  resetGame,
} = gameSlice.actions;

export default gameSlice.reducer;
