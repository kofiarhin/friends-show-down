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
const { getQuestionsByGenre, MIN_QUESTIONS_PER_GENRE, isValidGenre } = require("../../utils/questionBank");

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
      const existing = getPlayerByNickname(gameId, nickname);
      if (existing && !existing.connected) {
        // Reconnect to in-progress game
        const wasHost = existing.playerId === game.hostId;
        existing.playerId = socket.id;
        existing.connected = true;
        if (wasHost || isHost) {
          game.hostId = socket.id;
        }

        socket.join(gameId);
        io.to(gameId).emit("players:updated", { players: sanitizePlayers(game.players) });

        if (game.currentQuestion && !game.questionAnswered) {
          const timeLimit = parseInt(process.env.QUESTION_TIME_LIMIT) || 20;
          socket.emit("question:start", {
            questionNumber: game.session.current + 1,
            totalQuestions: game.session.totalQuestions,
            question: game.currentQuestion,
            timeLimit,
          });
          if (game.playState === "paused") {
            socket.emit("game:paused", { remainingTimeMs: game.remainingTimeMs });
          }
        }
        return;
      }
      return socket.emit("join:error", { message: "Game already in progress." });
    }

    if (game.status === "ended") {
      const existing = getPlayerByNickname(gameId, nickname);
      if (existing && !existing.connected) {
        // Reconnect to ended game
        const wasHost = existing.playerId === game.hostId;
        existing.playerId = socket.id;
        existing.connected = true;
        if (wasHost || isHost) {
          game.hostId = socket.id;
        }
        socket.join(gameId);
        socket.emit("game:end", buildGameEnd(game));
        io.to(gameId).emit("players:updated", { players: sanitizePlayers(game.players) });
        return;
      } else if (!existing) {
        // New player joining post-game
        const nicknameNormalized = nickname.trim();
        if (!nicknameNormalized || nicknameNormalized.length > 20) {
          return socket.emit("join:error", { message: "Nickname must be 1–20 characters." });
        }
        addPlayer(gameId, { playerId: socket.id, nickname: nicknameNormalized, score: 0, connected: true });
        socket.join(gameId);
        socket.emit("game:end", buildGameEnd(game));
        io.to(gameId).emit("players:updated", { players: sanitizePlayers(game.players) });
        return;
      } else {
        return socket.emit("join:error", { message: "Nickname already taken." });
      }
    }

    // Waiting state — check for reconnect first
    const existing = getPlayerByNickname(gameId, nickname);
    if (existing && !existing.connected) {
      const wasHost = existing.playerId === game.hostId;
      existing.playerId = socket.id;
      existing.connected = true;
      if (wasHost || isHost) game.hostId = socket.id;

      socket.join(gameId);
      clearExpiryTimer(gameId);
      setExpiryTimer(gameId, WAITING_EXPIRY_MS);
      io.to(gameId).emit("lobby:updated", { players: sanitizePlayers(game.players), genre: game.config.genre });
      return;
    }

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

    if (!game.hostId) {
      game.hostId = socket.id;
    }
    if (isHost) {
      game.hostId = socket.id;
    }

    clearExpiryTimer(gameId);
    setExpiryTimer(gameId, WAITING_EXPIRY_MS);

    io.to(gameId).emit("lobby:updated", { players: sanitizePlayers(game.players), genre: game.config.genre });
  });

  // game:start — host starts the game
  socket.on("game:start", ({ gameId }) => {
    const game = getGame(gameId);

    if (!game) return;
    if (game.hostId !== socket.id) return;
    if (game.status !== "waiting") return;
    if (game.players.filter((p) => p.connected).length < 2) return;

    const genre = game.config.genre;
    const pool = getQuestionsByGenre(genre);

    if (pool.length < MIN_QUESTIONS_PER_GENRE) {
      return socket.emit("start:error", {
        message: `Not enough questions for this category. Try a different one.`,
      });
    }

    game.status = "in-progress";
    clearExpiryTimer(gameId);

    const shuffledQuestions = shuffleArray(pool);
    game.session.questions = shuffledQuestions;
    game.session.totalQuestions = shuffledQuestions.length;
    game.session.current = 0;

    emitQuestion(io, gameId);
  });

  // game:end-early — host ends from lobby (cancel) or from in-progress
  socket.on("game:end-early", ({ gameId }) => {
    const game = getGame(gameId);
    if (!game) return socket.emit("action:error", { message: "Game not found." });
    if (socket.id !== game.hostId) return socket.emit("action:error", { message: "Only the host can do that." });
    if (game.status === "ended") return; // silently ignore

    if (game.status === "waiting") {
      // Cancel from lobby
      io.to(gameId).emit("game:closed", { reason: "host_ended" });
      deleteGame(gameId);
      return;
    }

    // In-progress — end early
    if (game.questionTimer) { clearTimeout(game.questionTimer); game.questionTimer = null; }
    if (game.transitionTimer) { clearTimeout(game.transitionTimer); game.transitionTimer = null; }

    const { winnerId, winnerNickname } = computeWinner(game.players);
    game.status = "ended";
    game.playState = "running";
    game.remainingTimeMs = null;
    game.endReason = "host_ended";
    game.lastRoundResults = {
      scores: game.players.map(p => ({ ...p })),
      winnerId,
      winnerNickname,
      endReason: "host_ended",
    };

    io.to(gameId).emit("game:end", buildGameEnd(game));
    setExpiryTimer(gameId, ENDED_EXPIRY_MS, () => {
      io.to(gameId).emit("game:closed", { reason: "expired" });
      deleteGame(gameId);
    });
  });

  // game:restart — host restarts a new round in the same room
  socket.on("game:restart", ({ gameId }) => {
    const game = getGame(gameId);
    if (!game) return socket.emit("action:error", { message: "Game not found." });
    if (socket.id !== game.hostId) return socket.emit("action:error", { message: "Only the host can do that." });
    if (game.status !== "ended") return socket.emit("action:error", { message: "Can only restart after a round has ended." });

    clearExpiryTimer(gameId);

    // Reset round state
    game.session = { questions: [], current: 0, totalQuestions: 0 };
    game.currentQuestion = null;
    game.questionAnswered = false;
    game.questionSubmissions = new Set();
    game.questionTimer = null;
    game.transitionTimer = null;
    game.questionStartedAt = null;
    game.playState = "running";
    game.remainingTimeMs = null;
    game.endReason = null;
    game.lastRoundResults = null;

    game.players.forEach(p => { p.score = 0; });
    game.status = "waiting";

    setExpiryTimer(gameId, WAITING_EXPIRY_MS);

    io.to(gameId).emit("game:restarted", { players: sanitizePlayers(game.players), genre: game.config.genre });
  });

  // game:close-room — host closes the room from post-game screen
  socket.on("game:close-room", ({ gameId }) => {
    const game = getGame(gameId);
    if (!game) return socket.emit("action:error", { message: "Game not found." });
    if (socket.id !== game.hostId) return socket.emit("action:error", { message: "Only the host can do that." });
    if (game.status !== "ended") return socket.emit("action:error", { message: "Can only close room after a round has ended." });

    io.to(gameId).emit("game:closed", { reason: "host_ended" });
    deleteGame(gameId);
  });

  // room:set-genre — host changes genre while room is in ended state
  socket.on("room:set-genre", ({ gameId, genre }) => {
    const game = getGame(gameId);
    if (!game) return socket.emit("action:error", { message: "Game not found." });
    if (socket.id !== game.hostId) return socket.emit("action:error", { message: "Only the host can do that." });
    if (game.status !== "ended") return socket.emit("action:error", { message: "Genre can only be changed after a round ends." });
    if (!isValidGenre(genre)) return socket.emit("action:error", { message: "Invalid genre." });

    game.config.genre = genre;
    io.to(gameId).emit("genre:updated", { genre });
  });

  // game:pause — host pauses an active question
  socket.on("game:pause", ({ gameId }) => {
    const game = getGame(gameId);
    if (!game) return socket.emit("action:error", { message: "Game not found." });
    if (socket.id !== game.hostId) return socket.emit("action:error", { message: "Only the host can do that." });
    if (game.status !== "in-progress") return socket.emit("action:error", { message: "Game is not in progress." });
    if (game.playState === "paused") return; // silently ignore
    if (game.questionAnswered) return socket.emit("action:error", { message: "Cannot pause between questions." });

    const timeLimit = parseInt(process.env.QUESTION_TIME_LIMIT) || 20;
    const elapsed = Date.now() - game.questionStartedAt;
    const remaining = Math.max(0, timeLimit * 1000 - elapsed);

    clearTimeout(game.questionTimer);
    game.questionTimer = null;
    game.remainingTimeMs = remaining;
    game.playState = "paused";

    io.to(gameId).emit("game:paused", { remainingTimeMs: remaining });
  });

  // game:resume — host resumes a paused question
  socket.on("game:resume", ({ gameId }) => {
    const game = getGame(gameId);
    if (!game) return socket.emit("action:error", { message: "Game not found." });
    if (socket.id !== game.hostId) return socket.emit("action:error", { message: "Only the host can do that." });
    if (game.status !== "in-progress") return socket.emit("action:error", { message: "Game is not in progress." });
    if (game.playState === "running") return; // silently ignore

    game.playState = "running";
    game.questionStartedAt = Date.now() - (((parseInt(process.env.QUESTION_TIME_LIMIT) || 20) * 1000) - game.remainingTimeMs);
    game.questionTimer = setTimeout(() => {
      const g = getGame(gameId);
      if (g && !g.questionAnswered) {
        endQuestion(io, gameId, null, null);
      }
    }, game.remainingTimeMs);

    const remainingTimeMs = game.remainingTimeMs;
    game.remainingTimeMs = null;

    io.to(gameId).emit("game:resumed", { remainingTimeMs });
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
  game.questionStartedAt = Date.now();
  game.playState = "running";
  game.remainingTimeMs = null;

  const timeLimit = parseInt(process.env.QUESTION_TIME_LIMIT) || 20;

  io.to(gameId).emit("question:start", {
    questionNumber: game.session.current + 1,
    totalQuestions: game.session.totalQuestions,
    question: questionForClient,
    timeLimit,
  });

  game.questionTimer = setTimeout(() => {
    const g = getGame(gameId);
    if (g && !g.questionAnswered) {
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

  game.transitionTimer = setTimeout(() => {
    const g = getGame(gameId);
    if (!g) return;
    g.transitionTimer = null;

    if (g.session.current < g.session.totalQuestions - 1) {
      g.session.current += 1;
      emitQuestion(io, gameId);
    } else {
      const { winnerId: finalWinnerId, winnerNickname: finalWinnerNickname } = computeWinner(g.players);
      g.status = "ended";
      g.endReason = "completed";
      g.lastRoundResults = {
        scores: g.players.map(p => ({ ...p })),
        winnerId: finalWinnerId,
        winnerNickname: finalWinnerNickname,
        endReason: "completed",
      };
      io.to(gameId).emit("game:end", buildGameEnd(g));
      setExpiryTimer(gameId, ENDED_EXPIRY_MS, () => {
        io.to(gameId).emit("game:closed", { reason: "expired" });
        deleteGame(gameId);
      });
    }
  }, 3000);
}

function computeWinner(players) {
  const sorted = [...players].sort((a, b) => b.score - a.score);
  const topScore = sorted[0]?.score ?? 0;
  const topPlayers = sorted.filter(p => p.score === topScore);
  return {
    winnerId: topPlayers.length === 1 ? topPlayers[0].playerId : null,
    winnerNickname: topPlayers.length === 1 ? topPlayers[0].nickname : null,
  };
}

function buildGameEnd(game) {
  const { winnerId, winnerNickname } = game.lastRoundResults
    ? { winnerId: game.lastRoundResults.winnerId, winnerNickname: game.lastRoundResults.winnerNickname }
    : computeWinner(game.players);
  return {
    scores: sanitizePlayers(game.players),
    winnerId,
    winnerNickname,
    endReason: game.endReason ?? "completed",
    genre: game.config.genre,
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
