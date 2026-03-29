const { createGame, addPlayer, deleteGame } = require("../../store/gameStore");
const { registerChatHandlers } = require("./chatHandlers");

const GAME_ID = "chat-handlers-test";

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
    join: jest.fn(),
    emitted,
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

describe("chatHandlers", () => {
  afterEach(() => deleteGame(GAME_ID));

  it("broadcasts chat messages when the player is in the lobby", () => {
    const game = createGame(GAME_ID, null, "mixed");
    addPlayer(GAME_ID, {
      playerId: "player-1",
      nickname: "Alice",
      score: 0,
      connected: true,
    });

    const ioEvents = [];
    const io = makeIo(ioEvents);
    const socket = makeSocket("player-1");

    registerChatHandlers(io, socket);
    socket.trigger("chat:send", {
      gameId: GAME_ID,
      message: "Hello lobby",
    });

    expect(ioEvents).toHaveLength(1);
    expect(ioEvents[0].event).toBe("chat:message");
    expect(ioEvents[0].payload).toMatchObject({
      message: "Hello lobby",
      nickname: "Alice",
      playerId: "player-1",
    });
    expect(typeof ioEvents[0].payload.messageId).toBe("string");
  });

  it("rejects chat during an active question", () => {
    const game = createGame(GAME_ID, null, "mixed");
    game.status = "in-progress";
    game.roundPhase = "question_live";
    addPlayer(GAME_ID, {
      playerId: "player-1",
      nickname: "Alice",
      score: 0,
      connected: true,
    });

    const ioEvents = [];
    const io = makeIo(ioEvents);
    const socket = makeSocket("player-1");

    registerChatHandlers(io, socket);
    socket.trigger("chat:send", {
      gameId: GAME_ID,
      message: "Can I chat?",
    });

    expect(socket.emitted).toContainEqual({
      event: "chat:error",
      payload: {
        code: "chat_unavailable",
        message: "Chat is not available right now.",
      },
    });
    expect(ioEvents).toHaveLength(0);
  });

  it("rejects invalid chat payloads", () => {
    createGame(GAME_ID, null, "mixed");
    const ioEvents = [];
    const io = makeIo(ioEvents);
    const socket = makeSocket("player-1");

    registerChatHandlers(io, socket);
    socket.trigger("chat:send", { gameId: GAME_ID, message: "   " });

    expect(socket.emitted).toContainEqual({
      event: "chat:error",
      payload: {
        code: "invalid_payload",
        message: "Invalid chat payload.",
      },
    });
  });
});
