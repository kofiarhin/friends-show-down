const { createGame, addPlayer, deleteGame, getGame } = require("../../store/gameStore");
const { endQuestion, registerGameHandlers } = require("./gameHandlers");

const GAME_ID = "phase-flow-test";

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

function setupGame({ totalQuestions = 2 } = {}) {
  deleteGame(GAME_ID);
  const game = createGame(GAME_ID, "host-id", "mixed");
  addPlayer(GAME_ID, { playerId: "host-id", nickname: "Host", score: 0, connected: true });
  addPlayer(GAME_ID, { playerId: "p2-id", nickname: "Bob", score: 0, connected: true });

  game.status = "in-progress";
  game.session.questions = [
    { id: "q1", prompt: "Q1", options: ["A", "B"], correctAnswer: "A" },
    { id: "q2", prompt: "Q2", options: ["C", "D"], correctAnswer: "C" },
  ].slice(0, totalQuestions);
  game.session.totalQuestions = totalQuestions;
  game.session.current = 0;
  game.questionAnswered = false;

  return game;
}

describe("gameHandlers phase transitions", () => {
  beforeEach(() => {
    jest.useFakeTimers();
  });

  afterEach(() => {
    jest.useRealTimers();
    deleteGame(GAME_ID);
  });

  it("emits question:end, then round:phase(hype), then question:start", () => {
    setupGame({ totalQuestions: 2 });
    const events = [];
    const io = makeIo(events);

    endQuestion(io, GAME_ID, "host-id", "Host");

    expect(events.map((e) => e.event)).toEqual(["question:end", "round:phase"]);
    expect(events[0].payload.roundPhase).toBe("question_result");
    expect(events[1].payload.roundPhase).toBe("question_hype");

    jest.advanceTimersByTime(3000);

    expect(events.map((e) => e.event)).toEqual(["question:end", "round:phase", "question:start"]);
    expect(events[2].payload.roundPhase).toBe("question_live");
  });

  it("does not emit hype on final question; emits game:end", () => {
    setupGame({ totalQuestions: 1 });
    const events = [];
    const io = makeIo(events);

    endQuestion(io, GAME_ID, null, null);

    expect(events.map((e) => e.event)).toEqual(["question:end"]);

    jest.advanceTimersByTime(3000);

    expect(events.map((e) => e.event)).toEqual(["question:end", "game:end"]);
  });

  it("stores hype phase snapshot for reconnect during transition", () => {
    const game = setupGame({ totalQuestions: 2 });
    const events = [];
    const io = makeIo(events);

    endQuestion(io, GAME_ID, null, null);

    expect(game.roundPhase).toBe("question_hype");
    expect(game.phaseStartedAt).toBeTruthy();
    expect(game.phaseEndsAt).toBeGreaterThan(game.phaseStartedAt);
  });

  it("reconnect during hype receives round:phase snapshot", () => {
    const game = setupGame({ totalQuestions: 2 });
    game.roundPhase = "question_hype";
    game.phaseStartedAt = Date.now();
    game.phaseEndsAt = game.phaseStartedAt + 3000;
    game.lastQuestionResult = {
      winnerId: "host-id",
      winnerNickname: "Host",
      correctAnswer: "A",
    };
    game.players[1].connected = false;

    const ioEvents = [];
    const io = makeIo(ioEvents);
    const socket = makeSocket("reconnected-id");
    registerGameHandlers(io, socket);

    socket.trigger("game:join", { gameId: GAME_ID, nickname: "Bob", isHost: false });

    const phaseEvent = socket.emitted.find((e) => e.event === "round:phase");
    expect(phaseEvent).toBeTruthy();
    expect(phaseEvent.payload.roundPhase).toBe("question_hype");
    expect(phaseEvent.payload.phaseEndsAt).toBe(game.phaseEndsAt);
  });
});
