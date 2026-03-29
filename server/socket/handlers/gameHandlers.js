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
const {
  getQuestionsByGenre,
  MIN_QUESTIONS_PER_GENRE,
  isValidGenre,
} = require("../../utils/questionBank");

const WAITING_EXPIRY_MS = 30 * 60 * 1000; // 30 min
const ENDED_EXPIRY_MS = 15 * 60 * 1000; // 15 min
const ROUND_TRANSITION_MS =
  parseInt(process.env.ROUND_TRANSITION_MS, 10) || 5000;

function registerGameHandlers(io, socket) {
  // game:join — player registers in a session
  socket.on("game:join", (payload) => {
    const parsedPayload = parseJoinPayload(payload);
    if (!parsedPayload) {
      return socket.emit("join:error", { message: "Invalid join payload." });
    }

    const { gameId, nickname, hostToken } = parsedPayload;
    const game = getGame(gameId);

    if (!game) {
      return socket.emit("join:error", { message: "Game not found." });
    }

    const hasValidHostToken = Boolean(hostToken) && hostToken === game.hostToken;

    if (game.status === "in-progress") {
      const existing = getPlayerByNickname(gameId, nickname);
      if (existing && !existing.connected) {
        // Reconnect to in-progress game
        const wasHost = existing.playerId === game.hostId;
        if (wasHost && !hasValidHostToken) {
          return socket.emit("join:error", {
            message: "Host reconnection requires a valid host token.",
          });
        }

        existing.playerId = socket.id;
        existing.connected = true;
        if (wasHost) {
          game.hostId = socket.id;
        }

        socket.join(gameId);
        io.to(gameId).emit("players:updated", {
          players: sanitizePlayers(game.players),
        });

        if (game.roundPhase === "question_hype") {
          emitHypePhase(socket, game, gameId);
          return;
        }

        if (game.currentQuestion && !game.questionAnswered) {
          const timeLimit = parseInt(process.env.QUESTION_TIME_LIMIT) || 20;
          socket.emit("question:start", {
            gameCode: gameId,
            questionNumber: game.session.current + 1,
            totalQuestions: game.session.totalQuestions,
            question: game.currentQuestion,
            timeLimit,
            roundPhase: game.roundPhase || "question_live",
            phaseStartedAt: game.phaseStartedAt,
          });
          if (game.playState === "paused") {
            socket.emit("game:paused", {
              remainingTimeMs: game.remainingTimeMs,
            });
          }
        }
        return;
      }
      return socket.emit("join:error", {
        message: "Game already in progress.",
      });
    }

    if (game.status === "ended") {
      const existing = getPlayerByNickname(gameId, nickname);
      if (existing && !existing.connected) {
        // Reconnect to ended game
        const wasHost = existing.playerId === game.hostId;
        if (wasHost && !hasValidHostToken) {
          return socket.emit("join:error", {
            message: "Host reconnection requires a valid host token.",
          });
        }

        existing.playerId = socket.id;
        existing.connected = true;
        if (wasHost) {
          game.hostId = socket.id;
        }
        socket.join(gameId);
        socket.emit("game:end", buildGameEnd(game));
        io.to(gameId).emit("players:updated", {
          players: sanitizePlayers(game.players),
        });
        return;
      } else if (!existing) {
        // New player joining post-game
        const nicknameNormalized = nickname.trim();
        if (!nicknameNormalized || nicknameNormalized.length > 20) {
          return socket.emit("join:error", {
            message: "Nickname must be 1–20 characters.",
          });
        }
        addPlayer(gameId, {
          playerId: socket.id,
          nickname: nicknameNormalized,
          score: 0,
          connected: true,
        });
        socket.join(gameId);
        socket.emit("game:end", buildGameEnd(game));
        io.to(gameId).emit("players:updated", {
          players: sanitizePlayers(game.players),
        });
        return;
      } else {
        return socket.emit("join:error", {
          message: "Nickname already taken.",
        });
      }
    }

    // Waiting state — check for reconnect first
    const existing = getPlayerByNickname(gameId, nickname);
    if (existing && !existing.connected) {
      const wasHost = existing.playerId === game.hostId;
      if (wasHost && !hasValidHostToken) {
        return socket.emit("join:error", {
          message: "Host reconnection requires a valid host token.",
        });
      }

      existing.playerId = socket.id;
      existing.connected = true;
      if (wasHost) game.hostId = socket.id;

      socket.join(gameId);
      clearExpiryTimer(gameId);
      setExpiryTimer(gameId, WAITING_EXPIRY_MS);
      io.to(gameId).emit("lobby:updated", {
        players: sanitizePlayers(game.players),
        genre: game.config.genre,
      });
      return;
    }

    const nicknameNormalized = nickname.trim();
    if (!nicknameNormalized || nicknameNormalized.length > 20) {
      return socket.emit("join:error", {
        message: "Nickname must be 1–20 characters.",
      });
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

    if (!game.hostId && hasValidHostToken) {
      game.hostId = socket.id;
    }

    clearExpiryTimer(gameId);
    setExpiryTimer(gameId, WAITING_EXPIRY_MS);

    io.to(gameId).emit("lobby:updated", {
      players: sanitizePlayers(game.players),
      genre: game.config.genre,
    });
  });

  // game:start — host starts the game
  socket.on("game:start", (payload) => {
    const parsedPayload = parseGameIdPayload(payload);
    if (!parsedPayload) {
      return socket.emit("start:error", { message: "Invalid payload." });
    }

    const { gameId } = parsedPayload;
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
  socket.on("game:end-early", (payload) => {
    const parsedPayload = parseGameIdPayload(payload);
    if (!parsedPayload) {
      return socket.emit("action:error", { message: "Invalid payload." });
    }

    const { gameId } = parsedPayload;
    const game = getGame(gameId);
    if (!game)
      return socket.emit("action:error", { message: "Game not found." });
    if (socket.id !== game.hostId)
      return socket.emit("action:error", {
        message: "Only the host can do that.",
      });
    if (game.status === "ended") return; // silently ignore

    if (game.status === "waiting") {
      // Cancel from lobby
      io.to(gameId).emit("game:closed", { reason: "host_ended" });
      deleteGame(gameId);
      return;
    }

    // In-progress — end early
    if (game.questionTimer) {
      clearTimeout(game.questionTimer);
      game.questionTimer = null;
    }
    if (game.transitionTimer) {
      clearTimeout(game.transitionTimer);
      game.transitionTimer = null;
    }

    const { winnerId, winnerNickname } = computeWinner(game.players);
    game.status = "ended";
    game.playState = "running";
    game.remainingTimeMs = null;
    game.roundPhase = null;
    game.phaseStartedAt = null;
    game.phaseEndsAt = null;
    game.endReason = "host_ended";
    game.lastRoundResults = {
      scores: game.players.map((p) => ({ ...p })),
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
  socket.on("game:restart", (payload) => {
    const parsedPayload = parseGameIdPayload(payload);
    if (!parsedPayload) {
      return socket.emit("action:error", { message: "Invalid payload." });
    }

    const { gameId } = parsedPayload;
    const game = getGame(gameId);
    if (!game)
      return socket.emit("action:error", { message: "Game not found." });
    if (socket.id !== game.hostId)
      return socket.emit("action:error", {
        message: "Only the host can do that.",
      });
    if (game.status !== "ended")
      return socket.emit("action:error", {
        message: "Can only restart after a round has ended.",
      });

    clearExpiryTimer(gameId);

    // Reset round state
    game.session = { questions: [], current: 0, totalQuestions: 0 };
    game.currentQuestion = null;
    game.questionAnswered = false;
    game.lastQuestionResult = null;
    game.roundPhase = null;
    game.phaseStartedAt = null;
    game.phaseEndsAt = null;
    game.questionSubmissions = new Set();
    game.questionTimer = null;
    game.transitionTimer = null;
    game.questionStartedAt = null;
    game.playState = "running";
    game.remainingTimeMs = null;
    game.endReason = null;
    game.lastRoundResults = null;

    game.players.forEach((p) => {
      p.score = 0;
    });
    game.status = "waiting";

    setExpiryTimer(gameId, WAITING_EXPIRY_MS);

    io.to(gameId).emit("game:restarted", {
      players: sanitizePlayers(game.players),
      genre: game.config.genre,
    });
  });

  // game:close-room — host closes the room from post-game screen
  socket.on("game:close-room", (payload) => {
    const parsedPayload = parseGameIdPayload(payload);
    if (!parsedPayload) {
      return socket.emit("action:error", { message: "Invalid payload." });
    }

    const { gameId } = parsedPayload;
    const game = getGame(gameId);
    if (!game)
      return socket.emit("action:error", { message: "Game not found." });
    if (socket.id !== game.hostId)
      return socket.emit("action:error", {
        message: "Only the host can do that.",
      });
    if (game.status !== "ended")
      return socket.emit("action:error", {
        message: "Can only close room after a round has ended.",
      });

    io.to(gameId).emit("game:closed", { reason: "host_ended" });
    deleteGame(gameId);
  });

  // room:set-genre — host changes genre while room is in ended state
  socket.on("room:set-genre", (payload) => {
    const parsedPayload = parseSetGenrePayload(payload);
    if (!parsedPayload) {
      return socket.emit("action:error", { message: "Invalid payload." });
    }

    const { gameId, genre } = parsedPayload;
    const game = getGame(gameId);
    if (!game)
      return socket.emit("action:error", { message: "Game not found." });
    if (socket.id !== game.hostId)
      return socket.emit("action:error", {
        message: "Only the host can do that.",
      });
    if (game.status !== "ended")
      return socket.emit("action:error", {
        message: "Genre can only be changed after a round ends.",
      });
    if (!isValidGenre(genre))
      return socket.emit("action:error", { message: "Invalid genre." });

    game.config.genre = genre;
    io.to(gameId).emit("genre:updated", { genre });
  });

  // game:pause — host pauses an active question
  socket.on("game:pause", (payload) => {
    const parsedPayload = parseGameIdPayload(payload);
    if (!parsedPayload) {
      return socket.emit("action:error", { message: "Invalid payload." });
    }

    const { gameId } = parsedPayload;
    const game = getGame(gameId);
    if (!game)
      return socket.emit("action:error", { message: "Game not found." });
    if (socket.id !== game.hostId)
      return socket.emit("action:error", {
        message: "Only the host can do that.",
      });
    if (game.status !== "in-progress")
      return socket.emit("action:error", {
        message: "Game is not in progress.",
      });
    if (game.playState === "paused") return; // silently ignore
    if (game.roundPhase !== "question_live" || game.questionAnswered) {
      return socket.emit("action:error", {
        message: "Cannot pause between questions.",
      });
    }

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
  socket.on("game:resume", (payload) => {
    const parsedPayload = parseGameIdPayload(payload);
    if (!parsedPayload) {
      return socket.emit("action:error", { message: "Invalid payload." });
    }

    const { gameId } = parsedPayload;
    const game = getGame(gameId);
    if (!game)
      return socket.emit("action:error", { message: "Game not found." });
    if (socket.id !== game.hostId)
      return socket.emit("action:error", {
        message: "Only the host can do that.",
      });
    if (game.status !== "in-progress")
      return socket.emit("action:error", {
        message: "Game is not in progress.",
      });
    if (game.playState === "running") return; // silently ignore

    game.playState = "running";
    game.questionStartedAt =
      Date.now() -
      ((parseInt(process.env.QUESTION_TIME_LIMIT) || 20) * 1000 -
        game.remainingTimeMs);
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

function parseJoinPayload(payload) {
  if (!isRecord(payload)) return null;

  const gameId = getTrimmedString(payload.gameId);
  const nickname = getTrimmedString(payload.nickname);
  const hostToken = getOptionalTrimmedString(payload.hostToken);

  if (!gameId || !nickname) {
    return null;
  }

  return {
    gameId,
    nickname,
    hostToken,
  };
}

function parseGameIdPayload(payload) {
  if (!isRecord(payload)) return null;

  const gameId = getTrimmedString(payload.gameId);
  if (!gameId) return null;

  return { gameId };
}

function parseSetGenrePayload(payload) {
  if (!isRecord(payload)) return null;

  const gameId = getTrimmedString(payload.gameId);
  const genre = getTrimmedString(payload.genre);

  if (!gameId || !genre) return null;

  return { gameId, genre };
}

function getTrimmedString(value) {
  return typeof value === "string" ? value.trim() : "";
}

function getOptionalTrimmedString(value) {
  if (value === undefined) return null;
  return typeof value === "string" && value.trim() ? value.trim() : null;
}

function isRecord(value) {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
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
  game.lastQuestionResult = null;
  game.questionSubmissions = new Set();
  game.questionStartedAt = Date.now();
  game.roundPhase = "question_live";
  game.phaseStartedAt = game.questionStartedAt;
  game.phaseEndsAt = null;
  game.playState = "running";
  game.remainingTimeMs = null;

  const timeLimit = parseInt(process.env.QUESTION_TIME_LIMIT) || 20;

  io.to(gameId).emit("question:start", {
    gameCode: gameId,
    questionNumber: game.session.current + 1,
    totalQuestions: game.session.totalQuestions,
    question: questionForClient,
    timeLimit,
    roundPhase: "question_live",
    phaseStartedAt: game.phaseStartedAt,
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
  game.roundPhase = "question_result";
  game.phaseStartedAt = Date.now();
  game.phaseEndsAt = null;

  const q = game.session.questions[game.session.current];
  const questionNumber = game.session.current + 1;
  const totalQuestions = game.session.totalQuestions;
  game.lastQuestionResult = {
    winnerId,
    winnerNickname,
    correctAnswer: q.correctAnswer,
  };

  io.to(gameId).emit("question:end", {
    gameCode: gameId,
    questionNumber,
    totalQuestions,
    winnerId,
    winnerNickname,
    correctAnswer: q.correctAnswer,
    scores: sanitizePlayers(game.players),
    roundPhase: "question_result",
    phaseStartedAt: game.phaseStartedAt,
  });

  game.transitionTimer = setTimeout(() => {
    const g = getGame(gameId);
    if (!g) return;
    g.transitionTimer = null;

    if (g.session.current < g.session.totalQuestions - 1) {
      g.session.current += 1;
      emitQuestion(io, gameId);
    } else {
      const { winnerId: finalWinnerId, winnerNickname: finalWinnerNickname } =
        computeWinner(g.players);
      g.status = "ended";
      g.roundPhase = null;
      g.phaseStartedAt = null;
      g.phaseEndsAt = null;
      g.endReason = "completed";
      g.lastRoundResults = {
        scores: g.players.map((p) => ({ ...p })),
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
  }, ROUND_TRANSITION_MS);

  if (game.session.current < game.session.totalQuestions - 1) {
    game.roundPhase = "question_hype";
    game.phaseStartedAt = Date.now();
    game.phaseEndsAt = game.phaseStartedAt + ROUND_TRANSITION_MS;
    io.to(gameId).emit("round:phase", buildHypePayload(game, gameId));
  }
}

function emitHypePhase(target, game, gameId) {
  if (game.roundPhase !== "question_hype") return;
  target.emit("round:phase", buildHypePayload(game, gameId));
}

function buildHypePayload(game, gameId) {
  return {
    gameCode: gameId,
    roundPhase: "question_hype",
    questionNumber: game.session.current + 2,
    totalQuestions: game.session.totalQuestions,
    phaseStartedAt: game.phaseStartedAt,
    phaseEndsAt: game.phaseEndsAt,
    durationMs: ROUND_TRANSITION_MS,
    lastResult: game.lastQuestionResult
      ? {
          winner: game.lastQuestionResult.winnerNickname,
          winnerId: game.lastQuestionResult.winnerId,
          correctAnswer: game.lastQuestionResult.correctAnswer,
        }
      : null,
  };
}

function computeWinner(players) {
  const sorted = [...players].sort((a, b) => b.score - a.score);
  const topScore = sorted[0]?.score ?? 0;
  const topPlayers = sorted.filter((p) => p.score === topScore);
  return {
    winnerId: topPlayers.length === 1 ? topPlayers[0].playerId : null,
    winnerNickname: topPlayers.length === 1 ? topPlayers[0].nickname : null,
  };
}

function buildGameEnd(game) {
  const { winnerId, winnerNickname } = game.lastRoundResults
    ? {
        winnerId: game.lastRoundResults.winnerId,
        winnerNickname: game.lastRoundResults.winnerNickname,
      }
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

module.exports = {
  registerGameHandlers,
  emitQuestion,
  endQuestion,
  sanitizePlayers,
};
