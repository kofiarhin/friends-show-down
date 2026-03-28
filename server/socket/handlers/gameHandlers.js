const {
  getGame,
  getPlayerByNickname,
  addPlayer,
  markDisconnected,
  markConnected,
  deleteGame,
  setExpiryTimer,
  clearExpiryTimer,
} = require("../../store/gameStore");
const { shuffleArray } = require("../../utils/shuffleArray");
const questions = require("../../data/questions.json");

const WAITING_EXPIRY_MS = 30 * 60 * 1000; // 30 min
const ENDED_EXPIRY_MS = 15 * 60 * 1000;   // 15 min

function registerGameHandlers(io, socket) {
  // game:join — player registers in a session
  socket.on("game:join", ({ gameId, nickname, isHost }) => {
    const game = getGame(gameId);

    if (!game) {
      return socket.emit("join:error", { message: "Game not found." });
    }

    if (game.status === "in-progress") {
      // Check if this is a reconnect
      const existing = getPlayerByNickname(gameId, nickname);
      if (existing && !existing.connected) {
        // Reconnect
        existing.playerId = socket.id;
        existing.connected = true;
        if (isHost || existing.nickname.toLowerCase() === game.players.find(p => p.playerId === game.hostId)?.nickname.toLowerCase()) {
          // don't reassign hostId here — handled below
        }
        // If the reconnecting player was the host, update hostId
        const wasHost = getGame(gameId).hostId === existing.playerId || isHost;
        if (wasHost || isHost) {
          game.hostId = socket.id;
        }

        socket.join(gameId);
        io.to(gameId).emit("players:updated", { players: sanitizePlayers(game.players) });

        // Re-emit current question state so reconnected client can navigate
        if (game.currentQuestion && !game.questionAnswered) {
          socket.emit("question:start", {
            questionNumber: game.session.current + 1,
            totalQuestions: game.session.totalQuestions,
            question: game.currentQuestion,
            timeLimit: parseInt(process.env.QUESTION_TIME_LIMIT) || 20,
          });
        } else if (game.status === "ended") {
          socket.emit("game:end", buildGameEnd(game));
        }
        return;
      }
      return socket.emit("join:error", { message: "Game already in progress." });
    }

    if (game.status === "ended") {
      // Reconnect to ended game
      const existing = getPlayerByNickname(gameId, nickname);
      if (existing) {
        existing.playerId = socket.id;
        existing.connected = true;
        socket.join(gameId);
        socket.emit("game:end", buildGameEnd(game));
        return;
      }
      return socket.emit("join:error", { message: "Game has ended." });
    }

    // Check for reconnect in waiting state
    const existing = getPlayerByNickname(gameId, nickname);
    if (existing && !existing.connected) {
      existing.playerId = socket.id;
      existing.connected = true;
      if (isHost) game.hostId = socket.id;

      socket.join(gameId);
      clearExpiryTimer(gameId);
      setExpiryTimer(gameId, WAITING_EXPIRY_MS);
      io.to(gameId).emit("lobby:updated", { players: sanitizePlayers(game.players) });
      return;
    }

    // Nickname uniqueness check
    const nicknameNormalized = nickname.trim();
    if (!nicknameNormalized || nicknameNormalized.length > 20) {
      return socket.emit("join:error", { message: "Nickname must be 1–20 characters." });
    }

    if (getPlayerByNickname(gameId, nicknameNormalized)) {
      return socket.emit("join:error", { message: "Nickname already taken." });
    }

    const player = {
      playerId: socket.id,
      nickname: nicknameNormalized,
      score: 0,
      connected: true,
    };

    addPlayer(gameId, player);
    socket.join(gameId);

    // First joiner becomes host if hostId not yet set
    if (!game.hostId) {
      game.hostId = socket.id;
    }
    if (isHost) {
      game.hostId = socket.id;
    }

    clearExpiryTimer(gameId);
    setExpiryTimer(gameId, WAITING_EXPIRY_MS);

    io.to(gameId).emit("lobby:updated", { players: sanitizePlayers(game.players) });
  });

  // game:start — host starts the game
  socket.on("game:start", ({ gameId }) => {
    const game = getGame(gameId);

    if (!game) return;
    if (game.hostId !== socket.id) return;
    if (game.status !== "waiting") return;
    if (game.players.filter((p) => p.connected).length < 2) return;

    game.status = "in-progress";
    clearExpiryTimer(gameId);

    const shuffledQuestions = shuffleArray(questions);
    game.session.questions = shuffledQuestions;
    game.session.totalQuestions = shuffledQuestions.length;
    game.session.current = 0;

    emitQuestion(io, gameId);
  });

}

function emitQuestion(io, gameId) {
  const game = getGame(gameId);
  if (!game) return;

  const q = game.session.questions[game.session.current];
  const shuffledOptions = shuffleArray(q.options);

  const questionForClient = {
    id: q.id,
    prompt: q.prompt,
    options: shuffledOptions,
    // correctAnswer intentionally omitted
  };

  game.currentQuestion = questionForClient;
  game.questionAnswered = false;
  game.questionSubmissions = new Set();

  const timeLimit = parseInt(process.env.QUESTION_TIME_LIMIT) || 20;

  io.to(gameId).emit("question:start", {
    questionNumber: game.session.current + 1,
    totalQuestions: game.session.totalQuestions,
    question: questionForClient,
    timeLimit,
  });

  // Server-side question timer
  game.questionTimer = setTimeout(() => {
    if (!game.questionAnswered) {
      endQuestion(io, gameId, null, null);
    }
  }, timeLimit * 1000);
}

function endQuestion(io, gameId, winnerId, winnerNickname) {
  const game = getGame(gameId);
  if (!game) return;

  if (game.questionTimer) {
    clearTimeout(game.questionTimer);
    game.questionTimer = null;
  }

  game.questionAnswered = true;

  const q = game.session.questions[game.session.current];

  io.to(gameId).emit("question:end", {
    questionNumber: game.session.current + 1,
    winnerId,
    winnerNickname,
    correctAnswer: q.correctAnswer,
    scores: sanitizePlayers(game.players),
  });

  // 3-second delay then next question or game end
  setTimeout(() => {
    const g = getGame(gameId);
    if (!g) return;

    if (g.session.current < g.session.totalQuestions - 1) {
      g.session.current += 1;
      emitQuestion(io, gameId);
    } else {
      g.status = "ended";
      io.to(gameId).emit("game:end", buildGameEnd(g));
      setExpiryTimer(gameId, ENDED_EXPIRY_MS);
    }
  }, 3000);
}

function buildGameEnd(game) {
  const sorted = [...game.players].sort((a, b) => b.score - a.score);
  const topScore = sorted[0]?.score ?? 0;
  const winners = sorted.filter((p) => p.score === topScore);
  return {
    scores: sanitizePlayers(game.players),
    winnerId: winners.length === 1 ? winners[0].playerId : null,
    winnerNickname: winners.length === 1 ? winners[0].nickname : null,
  };
}

function sanitizePlayers(players) {
  return players.map(({ playerId, nickname, score, connected }) => ({
    playerId,
    nickname,
    score,
    connected,
  }));
}

module.exports = { registerGameHandlers, emitQuestion, endQuestion, sanitizePlayers };
