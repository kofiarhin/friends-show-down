const { initSocket } = require("./index");
const {
  createGame,
  addPlayer,
  getGame,
  deleteGame,
} = require("../store/gameStore");

const GAME_ID = "socket-index-test";

function makeSocket(id) {
  const handlers = new Map();
  return {
    id,
    on(event, cb) {
      handlers.set(event, cb);
    },
    trigger(event) {
      const cb = handlers.get(event);
      if (!cb) throw new Error(`No handler for ${event}`);
      cb();
    },
  };
}

function makeIo(events) {
  const connectionHandlers = [];
  return {
    on(event, cb) {
      if (event === "connection") connectionHandlers.push(cb);
    },
    connect(socket) {
      connectionHandlers.forEach((cb) => cb(socket));
    },
    to(room) {
      return {
        emit(event, payload) {
          events.push({ room, event, payload });
        },
      };
    },
  };
}

describe("socket disconnect behavior", () => {
  beforeEach(() => {
    jest.useFakeTimers();
    delete process.env.HOST_RECONNECT_GRACE_MS;
  });

  afterEach(() => {
    jest.runOnlyPendingTimers();
    jest.useRealTimers();
    deleteGame(GAME_ID);
  });

  it("keeps waiting room alive during host refresh grace period", () => {
    const game = createGame(GAME_ID, "host-socket", "mixed", "token");
    game.hostId = "host-socket";
    addPlayer(GAME_ID, {
      playerId: "host-socket",
      nickname: "Host",
      score: 0,
      connected: true,
    });

    const events = [];
    const io = makeIo(events);
    initSocket(io);

    const hostSocket = makeSocket("host-socket");
    io.connect(hostSocket);

    hostSocket.trigger("disconnect");

    expect(getGame(GAME_ID)).not.toBeNull();
    expect(getGame(GAME_ID).players[0].connected).toBe(false);
    expect(events).toContainEqual({
      room: GAME_ID,
      event: "host:offline",
      payload: { reason: "disconnected" },
    });

    jest.advanceTimersByTime(14999);
    expect(getGame(GAME_ID)).not.toBeNull();

    jest.advanceTimersByTime(1);
    expect(getGame(GAME_ID)).toBeNull();
    expect(events).toContainEqual({
      room: GAME_ID,
      event: "game:closed",
      payload: { reason: "host_timeout" },
    });
  });
});
