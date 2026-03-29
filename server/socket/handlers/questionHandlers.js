const { getGame, updateScore } = require("../../store/gameStore");
const { endQuestion, sanitizePlayers } = require("./gameHandlers");

function registerQuestionHandlers(io, socket) {
  socket.on("answer:submit", (payload) => {
    const parsedPayload = parseAnswerPayload(payload);
    if (!parsedPayload) {
      return socket.emit("answer:rejected", { reason: "Invalid payload." });
    }

    const { gameId, questionNumber, answer } = parsedPayload;
    const game = getGame(gameId);
    if (!game) return;

    if (game.status !== "in-progress") {
      return socket.emit("answer:rejected", { reason: "Game is not in progress." });
    }

    if (game.playState === "paused") {
      return socket.emit("answer:rejected", { reason: "Game is paused." });
    }

    if (game.roundPhase !== "question_live") {
      return socket.emit("answer:rejected", { reason: "Question is not live." });
    }

    // Question number must match current (1-based)
    if (questionNumber !== game.session.current + 1) {
      return socket.emit("answer:rejected", { reason: "Question already over." });
    }

    // Question already resolved
    if (game.questionAnswered) {
      return socket.emit("answer:rejected", { reason: "Question already over." });
    }

    // Duplicate submission check
    if (game.questionSubmissions.has(socket.id)) {
      return socket.emit("answer:rejected", { reason: "Already submitted." });
    }

    // Record submission (regardless of correctness — one shot only)
    game.questionSubmissions.add(socket.id);

    const q = game.session.questions[game.session.current];

    if (answer === q.correctAnswer) {
      // First correct answer wins
      updateScore(gameId, socket.id);
      const player = game.players.find((p) => p.playerId === socket.id);
      endQuestion(io, gameId, socket.id, player?.nickname ?? null);
    } else {
      socket.emit("answer:rejected", { reason: "Incorrect." });
    }
  });
}

function parseAnswerPayload(payload) {
  if (!isRecord(payload)) return null;

  const gameId = getTrimmedString(payload.gameId);
  const questionNumber = Number.isInteger(payload.questionNumber)
    ? payload.questionNumber
    : null;
  const answer = typeof payload.answer === "string" ? payload.answer : null;

  if (!gameId || !questionNumber || !answer || !answer.trim()) {
    return null;
  }

  return {
    gameId,
    questionNumber,
    answer,
  };
}

function getTrimmedString(value) {
  return typeof value === "string" ? value.trim() : "";
}

function isRecord(value) {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

module.exports = { registerQuestionHandlers };
