const {
  createGame,
  addPlayer,
  deleteGame,
  getGame,
} = require("../../store/gameStore");
const { registerGameHandlers } = require("./gameHandlers");

const GAME_ID = "start-game-test";
const HOST_TOKEN = "host-token";

function makeIo(events) {
  return {
    to(room) {
      return {
        emit(event, payload) {
          events.push({ room, event, payload });
        },
      };
    },
  };
}

function makeSocket(id = "socket-1") {
  const handlers = new Map();
  const emitted = [];
  return {
    id,
    emitted,
    join: jest.fn(),
    on(event, cb) {
      handlers.set(event, cb);
    },
    emit(event, payload) {
      emitted.push({ event, payload });
    },
    trigger(event, payload) {
      const cb = handlers.get(event);
      if (!cb) throw new Error(`No handler for ${event}`);
      cb(payload);
    },
  };
}

describe("gameHandlers game:start", () => {
  afterEach(() => deleteGame(GAME_ID));

  it("emits start:error for invalid payload", () => {
    const io = makeIo([]);
    const socket = makeSocket("host");
    registerGameHandlers(io, socket);

    socket.trigger("game:start", null);

    expect(socket.emitted).toContainEqual({
      event: "start:error",
      payload: { message: "Invalid payload." },
    });
  });

  it("emits start:error when game is missing", () => {
    const io = makeIo([]);
    const socket = makeSocket("host");
    registerGameHandlers(io, socket);

    socket.trigger("game:start", { gameId: GAME_ID });

    expect(socket.emitted).toContainEqual({
      event: "start:error",
      payload: { message: "Game not found." },
    });
  });

  it("blocks non-host and emits start:error", () => {
    createGame(GAME_ID, "host-socket", "mixed", HOST_TOKEN);
    addPlayer(GAME_ID, {
      playerId: "host-socket",
      nickname: "Host",
      score: 0,
      connected: true,
    });
    addPlayer(GAME_ID, {
      playerId: "player-1",
      nickname: "Alice",
      score: 0,
      connected: true,
    });

    const io = makeIo([]);
    const socket = makeSocket("player-1");
    registerGameHandlers(io, socket);

    socket.trigger("game:start", { gameId: GAME_ID });

    expect(socket.emitted).toContainEqual({
      event: "start:error",
      payload: { message: "Only the host can start the game." },
    });
  });

  it("emits start:error when game is not waiting", () => {
    const game = createGame(GAME_ID, "host-socket", "mixed", HOST_TOKEN);
    game.status = "in-progress";
    const io = makeIo([]);
    const socket = makeSocket("host-socket");
    registerGameHandlers(io, socket);

    socket.trigger("game:start", { gameId: GAME_ID });

    expect(socket.emitted).toContainEqual({
      event: "start:error",
      payload: { message: "Game can only be started from the lobby." },
    });
  });

  it("emits start:error when not enough connected players", () => {
    createGame(GAME_ID, "host-socket", "mixed", HOST_TOKEN);
    addPlayer(GAME_ID, {
      playerId: "host-socket",
      nickname: "Host",
      score: 0,
      connected: true,
    });
    const io = makeIo([]);
    const socket = makeSocket("host-socket");
    registerGameHandlers(io, socket);

    socket.trigger("game:start", { gameId: GAME_ID });

    expect(socket.emitted).toContainEqual({
      event: "start:error",
      payload: { message: "Need at least 2 connected players to start." },
    });
  });

  it("lets reclaimed host start game successfully", () => {
    const game = createGame(GAME_ID, "old-host", "mixed", HOST_TOKEN);
    addPlayer(GAME_ID, {
      playerId: "old-host",
      nickname: "Host",
      score: 0,
      connected: false,
    });
    addPlayer(GAME_ID, {
      playerId: "player-1",
      nickname: "Alice",
      score: 0,
      connected: true,
    });

    const ioEvents = [];
    const io = makeIo(ioEvents);
    const socket = makeSocket("new-host");
    registerGameHandlers(io, socket);

    socket.trigger("game:join", {
      gameId: GAME_ID,
      nickname: "Host",
      hostToken: HOST_TOKEN,
    });

    expect(getGame(GAME_ID).hostId).toBe("new-host");

    socket.trigger("game:start", { gameId: GAME_ID });

    const updatedGame = getGame(GAME_ID);
    expect(updatedGame.status).toBe("in-progress");
    expect(ioEvents.some((event) => event.event === "question:start")).toBe(
      true,
    );
  });
});
