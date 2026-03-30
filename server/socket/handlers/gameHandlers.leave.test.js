const {
  createGame,
  addPlayer,
  getGame,
  deleteGame,
} = require("../../store/gameStore");
const { registerGameHandlers } = require("./gameHandlers");

const GAME_ID = "leave-game-test";

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
    leave: jest.fn(),
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

describe("gameHandlers game:leave", () => {
  afterEach(() => deleteGame(GAME_ID));

  it("removes a non-host from a waiting game and broadcasts lobby updates", () => {
    const game = createGame(GAME_ID, "host-socket", "mixed");
    game.hostId = "host-socket";
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

    const ioEvents = [];
    const io = makeIo(ioEvents);
    const socket = makeSocket("player-1");
    registerGameHandlers(io, socket);

    socket.trigger("game:leave", { gameId: GAME_ID });

    expect(ioEvents).toContainEqual({
      room: GAME_ID,
      event: "lobby:updated",
      payload: {
        players: [
          {
            playerId: "host-socket",
            nickname: "Host",
            score: 0,
            connected: true,
          },
        ],
        genre: "mixed",
      },
    });
    expect(getGame(GAME_ID).players).toHaveLength(1);
    expect(getGame(GAME_ID).players[0].playerId).toBe("host-socket");
    expect(socket.leave).toHaveBeenCalledWith(GAME_ID);
  });

  it("closes the room when the host leaves from waiting state", () => {
    const game = createGame(GAME_ID, "host-socket", "mixed");
    game.hostId = "host-socket";
    addPlayer(GAME_ID, {
      playerId: "host-socket",
      nickname: "Host",
      score: 0,
      connected: true,
    });

    const ioEvents = [];
    const io = makeIo(ioEvents);
    const socket = makeSocket("host-socket");
    registerGameHandlers(io, socket);

    socket.trigger("game:leave", { gameId: GAME_ID });

    expect(ioEvents).toContainEqual({
      room: GAME_ID,
      event: "game:closed",
      payload: { reason: "host_left" },
    });
    expect(getGame(GAME_ID)).toBeNull();
  });

  it("rejects invalid leave payloads", () => {
    createGame(GAME_ID, "host-socket", "mixed");
    const io = makeIo([]);
    const socket = makeSocket("player-1");
    registerGameHandlers(io, socket);

    socket.trigger("game:leave", null);

    expect(socket.emitted).toContainEqual({
      event: "action:error",
      payload: { message: "Invalid payload." },
    });
  });
});
