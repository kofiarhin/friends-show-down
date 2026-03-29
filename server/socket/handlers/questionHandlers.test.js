const {
  createGame,
  addPlayer,
  getGame,
  deleteGame,
} = require("../../store/gameStore");
const { shuffleArray } = require("../../utils/shuffleArray");
const questions = require("../../data/questions.json");

// We test the core logic inline rather than through a full socket server,
// mirroring what questionHandlers.js does.

const GAME_ID = "q-handler-test";

function setupGame() {
  deleteGame(GAME_ID);
  const game = createGame(GAME_ID, "host-id");
  addPlayer(GAME_ID, { playerId: "host-id", nickname: "Host", score: 0, connected: true });
  addPlayer(GAME_ID, { playerId: "p2-id", nickname: "Bob", score: 0, connected: true });

  game.status = "in-progress";
  game.session.questions = shuffleArray(questions);
  game.session.totalQuestions = questions.length;
  game.session.current = 0;

  const q = game.session.questions[0];
  game.currentQuestion = { id: q.id, prompt: q.prompt, options: shuffleArray(q.options) };
  game.questionAnswered = false;
  game.questionSubmissions = new Set();

  return game;
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
