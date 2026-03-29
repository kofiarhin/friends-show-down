const games = new Map();

function createGame(gameId, hostId, genre, hostToken = null) {
  const game = {
    gameId,
    hostId,
    hostToken,
    config: {
      genre,
    },
    status: "waiting",
    players: [],
    session: {
      questions: [],
      current: 0,
      totalQuestions: 0,
    },
    currentQuestion: null,
    questionAnswered: false,
    lastQuestionResult: null,
    roundPhase: null,
    phaseStartedAt: null,
    phaseEndsAt: null,
    questionSubmissions: new Set(),
    questionTimer: null,
    transitionTimer: null,
    questionStartedAt: null,
    playState: "running",
    remainingTimeMs: null,
    endReason: null,
    lastRoundResults: null,
    chatMessages: [],
    expiryTimer: null,
  };
  games.set(gameId, game);
  return game;
}

function getGame(gameId) {
  return games.get(gameId) || null;
}

function deleteGame(gameId) {
  const game = games.get(gameId);
  if (game && game.expiryTimer) clearTimeout(game.expiryTimer);
  games.delete(gameId);
}

function addPlayer(gameId, player) {
  const game = getGame(gameId);
  if (!game) return null;
  game.players.push(player);
  return game;
}

function getPlayer(gameId, playerId) {
  const game = getGame(gameId);
  if (!game) return null;
  return game.players.find((p) => p.playerId === playerId) || null;
}

function getPlayerByNickname(gameId, nickname) {
  const game = getGame(gameId);
  if (!game) return null;
  return (
    game.players.find(
      (p) => p.nickname.toLowerCase() === nickname.toLowerCase(),
    ) || null
  );
}

function updateScore(gameId, playerId, delta = 1) {
  const game = getGame(gameId);
  if (!game) return null;
  const player = game.players.find((p) => p.playerId === playerId);
  if (player) player.score += delta;
  return game;
}

function addChatMessage(gameId, message) {
  const game = getGame(gameId);
  if (!game) return null;
  if (!Array.isArray(game.chatMessages)) game.chatMessages = [];
  game.chatMessages.push(message);
  if (game.chatMessages.length > 50) {
    game.chatMessages.shift();
  }
  return game.chatMessages;
}

function getChatMessages(gameId) {
  const game = getGame(gameId);
  if (!game) return [];
  return Array.isArray(game.chatMessages) ? game.chatMessages : [];
}

function markDisconnected(gameId, playerId) {
  const game = getGame(gameId);
  if (!game) return null;
  const player = game.players.find((p) => p.playerId === playerId);
  if (player) player.connected = false;
  return game;
}

function markConnected(gameId, playerId) {
  const game = getGame(gameId);
  if (!game) return null;
  const player = game.players.find((p) => p.playerId === playerId);
  if (player) player.connected = true;
  return game;
}

function setExpiryTimer(gameId, ms, onExpire) {
  const game = getGame(gameId);
  if (!game) return;
  if (game.expiryTimer) clearTimeout(game.expiryTimer);
  game.expiryTimer = setTimeout(() => {
    deleteGame(gameId);
    if (onExpire) onExpire();
  }, ms);
}

function clearExpiryTimer(gameId) {
  const game = getGame(gameId);
  if (game && game.expiryTimer) {
    clearTimeout(game.expiryTimer);
    game.expiryTimer = null;
  }
}

module.exports = {
  _games: games,
  createGame,
  getGame,
  deleteGame,
  addPlayer,
  getPlayer,
  getPlayerByNickname,
  updateScore,
  addChatMessage,
  getChatMessages,
  markDisconnected,
  markConnected,
  setExpiryTimer,
  clearExpiryTimer,
};
