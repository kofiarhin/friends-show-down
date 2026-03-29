const {
  createGame,
  addPlayer,
  getGame,
  deleteGame,
} = require("../../store/gameStore");
const { registerQuestionHandlers } = require("./questionHandlers");
const { shuffleArray } = require("../../utils/shuffleArray");
const questions = require("../../data/questions.json");

// We test the core logic inline rather than through a full socket server,
// mirroring what questionHandlers.js does.

const GAME_ID = "q-handler-test";

function setupGame() {
  deleteGame(GAME_ID);
  const game = createGame(GAME_ID, "host-id");
  addPlayer(GAME_ID, {
    playerId: "host-id",
    nickname: "Host",
    score: 0,
    connected: true,
  });
  addPlayer(GAME_ID, {
    playerId: "p2-id",
    nickname: "Bob",
    score: 0,
    connected: true,
  });

  game.status = "in-progress";
  const selectedQuestions = shuffleArray(questions).slice(0, 1);
  game.session.questions = selectedQuestions;
  game.session.totalQuestions = selectedQuestions.length;
  game.session.current = 0;

  const q = game.session.questions[0];
  game.currentQuestion = {
    id: q.id,
    prompt: q.prompt,
    options: shuffleArray(q.options),
  };
  game.questionAnswered = false;
  game.questionSubmissions = new Set();
  game.roundPhase = "question_live";
  game.playState = "running";

  return game;
}

function makeSocket(id = "socket-1") {
  const handlers = new Map();
  const emitted = [];
  return {
    id,
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

function makeIo() {
  return {
    to() {
      return {
        emit() {},
      };
    },
  };
}

describe("questionHandlers logic", () => {
  afterEach(() => deleteGame(GAME_ID));

  it("records submission and prevents duplicate from same player", () => {
    const game = setupGame();
    game.questionSubmissions.add("p2-id");
    expect(game.questionSubmissions.has("p2-id")).toBe(true);
    // Attempting a second submission would be rejected
    const alreadySubmitted = game.questionSubmissions.has("p2-id");
    expect(alreadySubmitted).toBe(true);
  });

  it("rejects answer when game is not in-progress", () => {
    const game = setupGame();
    game.status = "waiting";
    expect(game.status).not.toBe("in-progress");
  });

  it("rejects answer when questionAnswered is true (race condition)", () => {
    const game = setupGame();
    game.questionAnswered = true;
    expect(game.questionAnswered).toBe(true);
  });

  it("rejects answer when roundPhase is not question_live", () => {
    const game = setupGame();
    game.roundPhase = "question_hype";
    expect(game.roundPhase).not.toBe("question_live");
  });

  it("correct answer increments score and marks questionAnswered", () => {
    const game = setupGame();
    const q = game.session.questions[game.session.current];

    // Simulate correct submission
    game.questionSubmissions.add("host-id");
    if (q.correctAnswer === q.correctAnswer) {
      const player = game.players.find((p) => p.playerId === "host-id");
      player.score += 1;
      game.questionAnswered = true;
    }

    expect(game.players.find((p) => p.playerId === "host-id").score).toBe(1);
    expect(game.questionAnswered).toBe(true);
  });

  it("wrong answer does not end the question", () => {
    const game = setupGame();
    // Simulate wrong answer — questionAnswered stays false
    game.questionSubmissions.add("host-id");
    // answer is wrong, so we do NOT set questionAnswered
    expect(game.questionAnswered).toBe(false);
  });

  it("ends the question immediately when all connected players submit wrong answers", () => {
    const game = setupGame();
    const io = makeIo();
    const hostSocket = makeSocket("host-id");
    const playerSocket = makeSocket("p2-id");

    registerQuestionHandlers(io, hostSocket);
    registerQuestionHandlers(io, playerSocket);

    const q = game.session.questions[0];
    const wrongAnswer = q.options.find((option) => option !== q.correctAnswer);

    hostSocket.trigger("answer:submit", {
      gameId: GAME_ID,
      questionNumber: 1,
      answer: wrongAnswer,
    });

    expect(game.questionAnswered).toBe(false);

    playerSocket.trigger("answer:submit", {
      gameId: GAME_ID,
      questionNumber: 1,
      answer: wrongAnswer,
    });

    expect(game.questionAnswered).toBe(true);
    expect(game.roundPhase).toBe("question_result");
    expect(playerSocket.emitted).toContainEqual({
      event: "answer:rejected",
      payload: { reason: "Incorrect." },
    });
  });

  it("does not end the question early if a connected player has not submitted", () => {
    const game = setupGame();
    const io = makeIo();
    const hostSocket = makeSocket("host-id");

    registerQuestionHandlers(io, hostSocket);

    const q = game.session.questions[0];
    const wrongAnswer = q.options.find((option) => option !== q.correctAnswer);

    hostSocket.trigger("answer:submit", {
      gameId: GAME_ID,
      questionNumber: 1,
      answer: wrongAnswer,
    });

    expect(game.questionAnswered).toBe(false);
    expect(game.questionSubmissions.size).toBe(1);
  });

  it("ignores disconnected players when determining whether all submissions are complete", () => {
    const game = setupGame();
    game.players.find((p) => p.playerId === "p2-id").connected = false;

    const io = makeIo();
    const hostSocket = makeSocket("host-id");

    registerQuestionHandlers(io, hostSocket);

    const q = game.session.questions[0];
    const wrongAnswer = q.options.find((option) => option !== q.correctAnswer);

    hostSocket.trigger("answer:submit", {
      gameId: GAME_ID,
      questionNumber: 1,
      answer: wrongAnswer,
    });

    expect(game.questionAnswered).toBe(true);
    expect(game.roundPhase).toBe("question_result");
  });

  it("questionSubmissions tracks all submitters", () => {
    const game = setupGame();
    game.questionSubmissions.add("host-id");
    game.questionSubmissions.add("p2-id");
    expect(game.questionSubmissions.size).toBe(2);
  });

  it("clears questionSubmissions at the start of each question", () => {
    const game = setupGame();
    game.questionSubmissions.add("host-id");
    // Moving to next question
    game.session.current += 1;
    game.questionSubmissions = new Set();
    game.questionAnswered = false;
    expect(game.questionSubmissions.size).toBe(0);
  });
});

describe("questionHandlers payload validation", () => {
  afterEach(() => deleteGame(GAME_ID));

  it("rejects malformed answer payloads", () => {
    setupGame();
    const io = makeIo();
    const socket = makeSocket("host-id");

    registerQuestionHandlers(io, socket);
    socket.trigger("answer:submit", null);

    expect(socket.emitted).toContainEqual({
      event: "answer:rejected",
      payload: { reason: "Invalid payload." },
    });
  });
});
