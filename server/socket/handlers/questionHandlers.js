const { getGame, updateScore } = require("../../store/gameStore");
const { endQuestion, sanitizePlayers } = require("./gameHandlers");

function registerQuestionHandlers(io, socket) {
  socket.on("answer:submit", ({ gameId, questionNumber, answer }) => {
    const game = getGame(gameId);
    if (!game) return;

    if (game.status !== "in-progress") {
      return socket.emit("answer:rejected", { reason: "Game is not in progress." });
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

module.exports = { registerQuestionHandlers };
