const {
  createGame,
  getGame,
  addPlayer,
  updateScore,
  markDisconnected,
  deleteGame,
} = require("./gameStore");

describe("gameStore", () => {
  const gameId = "test-game-1";
  const player = { playerId: "p1", nickname: "Alice", score: 0, connected: true };

  beforeEach(() => {
    deleteGame(gameId);
  });

  it("createGame stores a game with waiting status", () => {
    const game = createGame(gameId, "host-socket");
    expect(game.gameId).toBe(gameId);
    expect(game.status).toBe("waiting");
    expect(game.hostId).toBe("host-socket");
  });

  it("getGame returns the created game", () => {
    createGame(gameId, "h1");
    const game = getGame(gameId);
    expect(game).not.toBeNull();
    expect(game.gameId).toBe(gameId);
  });

  it("getGame returns null for unknown ID", () => {
    expect(getGame("nonexistent")).toBeNull();
  });

  it("addPlayer appends a player", () => {
    createGame(gameId, "h1");
    addPlayer(gameId, player);
    const game = getGame(gameId);
    expect(game.players).toHaveLength(1);
    expect(game.players[0].nickname).toBe("Alice");
  });

  it("updateScore increments the player score", () => {
    createGame(gameId, "h1");
    addPlayer(gameId, { ...player });
    updateScore(gameId, "p1");
    const game = getGame(gameId);
    expect(game.players[0].score).toBe(1);
  });

  it("markDisconnected sets connected to false", () => {
    createGame(gameId, "h1");
    addPlayer(gameId, { ...player });
    markDisconnected(gameId, "p1");
    const game = getGame(gameId);
    expect(game.players[0].connected).toBe(false);
  });
});
