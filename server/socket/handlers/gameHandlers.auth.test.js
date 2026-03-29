const {
  createGame,
  addPlayer,
  deleteGame,
} = require("../../store/gameStore");
const { registerGameHandlers } = require("./gameHandlers");

const GAME_ID = "host-auth-test";
const HOST_TOKEN = "valid-host-token";

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

describe("gameHandlers host authorization", () => {
  afterEach(() => deleteGame(GAME_ID));

  it("ignores self-assigned host claims without a valid token", () => {
    const game = createGame(GAME_ID, null, "mixed", HOST_TOKEN);
    const ioEvents = [];
    const io = makeIo(ioEvents);
    const socket = makeSocket("player-1");

    registerGameHandlers(io, socket);
    socket.trigger("game:join", {
      gameId: GAME_ID,
      nickname: "Alice",
      isHost: true,
    });

    expect(game.hostId).toBeNull();
    expect(game.players).toHaveLength(1);
    expect(game.players[0]).toMatchObject({
      playerId: "player-1",
      nickname: "Alice",
      connected: true,
    });
  });

  it("rejects host reconnect attempts without the host token", () => {
    const game = createGame(GAME_ID, "old-host", "mixed", HOST_TOKEN);
    addPlayer(GAME_ID, {
      playerId: "old-host",
      nickname: "Host",
      score: 0,
      connected: false,
    });

    const io = makeIo([]);
    const socket = makeSocket("reconnected-host");

    registerGameHandlers(io, socket);
    socket.trigger("game:join", {
      gameId: GAME_ID,
      nickname: "Host",
      isHost: true,
    });

    expect(socket.join).not.toHaveBeenCalled();
    expect(socket.emitted).toContainEqual({
      event: "join:error",
      payload: { message: "Host reconnection requires a valid host token." },
    });
    expect(game.hostId).toBe("old-host");
    expect(game.players[0]).toMatchObject({
      playerId: "old-host",
      connected: false,
    });
  });

  it("allows a disconnected host to reclaim host with a valid token", () => {
    const game = createGame(GAME_ID, "old-host", "mixed", HOST_TOKEN);
    addPlayer(GAME_ID, {
      playerId: "old-host",
      nickname: "Host",
      score: 0,
      connected: false,
    });

    const ioEvents = [];
    const io = makeIo(ioEvents);
    const socket = makeSocket("reconnected-host");

    registerGameHandlers(io, socket);
    socket.trigger("game:join", {
      gameId: GAME_ID,
      nickname: "Host",
      hostToken: HOST_TOKEN,
    });

    expect(socket.join).toHaveBeenCalledWith(GAME_ID);
    expect(game.hostId).toBe("reconnected-host");
    expect(game.players[0]).toMatchObject({
      playerId: "reconnected-host",
      connected: true,
    });
    expect(ioEvents.some((event) => event.event === "lobby:updated")).toBe(true);
  });

  it("rejects malformed join payloads before destructuring", () => {
    createGame(GAME_ID, null, "mixed", HOST_TOKEN);
    const io = makeIo([]);
    const socket = makeSocket("player-1");

    registerGameHandlers(io, socket);
    socket.trigger("game:join", null);

    expect(socket.emitted).toContainEqual({
      event: "join:error",
      payload: { message: "Invalid join payload." },
    });
  });
});
