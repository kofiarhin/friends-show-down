import { describe, it, expect } from "vitest";
import reducer, {
  setGame,
  setPlayerId,
  setStatus,
  setPlayers,
  addPlayer,
  updateScores,
  setCurrentQuestion,
  setQuestionResult,
  setRoundPhase,
  setHasAnswered,
  resetGame,
  hydrateSession,
} from "./gameSlice";

const initial = {
  gameId: null,
  playerId: null,
  nickname: null,
  isHost: false,
  hostToken: null,
  status: "idle",
  genre: null,
  players: [],
  currentQuestion: null,
  lastQuestionResult: null,
  roundPhase: null,
  phaseStartedAt: null,
  phaseEndsAt: null,
  hasAnswered: false,
  playState: "running",
  endReason: null,
  lastRoundResults: null,
  startError: null,
  chatMessages: [],
  chatError: null,
  hostOffline: false,
  isHydrated: false,
};

describe("gameSlice", () => {
  it("returns initial state", () => {
    expect(reducer(undefined, { type: "@@INIT" })).toEqual(initial);
  });


  it("hydrateSession restores persisted session and marks hydrated", () => {
    const state = reducer(
      undefined,
      hydrateSession({
        gameId: "abc",
        nickname: "Alice",
        isHost: true,
        hostToken: "token-123",
        status: "waiting",
        genre: "science",
      }),
    );

    expect(state.gameId).toBe("abc");
    expect(state.nickname).toBe("Alice");
    expect(state.isHost).toBe(true);
    expect(state.hostToken).toBe("token-123");
    expect(state.status).toBe("waiting");
    expect(state.genre).toBe("science");
    expect(state.isHydrated).toBe(true);
  });

  it("setGame updates gameId, nickname, isHost, and hostToken", () => {
    const state = reducer(
      undefined,
      setGame({
        gameId: "abc",
        nickname: "Alice",
        isHost: true,
        hostToken: "token-123",
      }),
    );
    expect(state.gameId).toBe("abc");
    expect(state.nickname).toBe("Alice");
    expect(state.isHost).toBe(true);
    expect(state.hostToken).toBe("token-123");
  });

  it("setPlayerId updates playerId", () => {
    const state = reducer(undefined, setPlayerId("socket-123"));
    expect(state.playerId).toBe("socket-123");
  });

  it("setStatus updates status", () => {
    const state = reducer(undefined, setStatus("in-progress"));
    expect(state.status).toBe("in-progress");
  });

  it("setPlayers replaces player list", () => {
    const players = [
      { playerId: "p1", nickname: "Alice", score: 0, connected: true },
    ];
    const state = reducer(undefined, setPlayers(players));
    expect(state.players).toHaveLength(1);
  });

  it("addPlayer appends a player", () => {
    const s1 = reducer(
      undefined,
      setPlayers([
        { playerId: "p1", nickname: "A", score: 0, connected: true },
      ]),
    );
    const s2 = reducer(
      s1,
      addPlayer({ playerId: "p2", nickname: "B", score: 0, connected: true }),
    );
    expect(s2.players).toHaveLength(2);
  });

  it("addPlayer does not duplicate", () => {
    const player = { playerId: "p1", nickname: "A", score: 0, connected: true };
    const s1 = reducer(undefined, setPlayers([player]));
    const s2 = reducer(s1, addPlayer(player));
    expect(s2.players).toHaveLength(1);
  });

  it("updateScores replaces players array", () => {
    const updated = [
      { playerId: "p1", nickname: "A", score: 3, connected: true },
    ];
    const state = reducer(undefined, updateScores(updated));
    expect(state.players[0].score).toBe(3);
  });

  it("setCurrentQuestion resets hasAnswered and lastQuestionResult", () => {
    const withAnswer = reducer(undefined, setHasAnswered(true));
    const q = {
      questionNumber: 1,
      totalQuestions: 5,
      question: {},
      timeLimit: 20,
    };
    const state = reducer(withAnswer, setCurrentQuestion(q));
    expect(state.hasAnswered).toBe(false);
    expect(state.lastQuestionResult).toBeNull();
    expect(state.currentQuestion).toEqual(q);
  });

  it("setQuestionResult stores result and updates scores", () => {
    const result = {
      winnerId: "p1",
      winnerNickname: "Alice",
      correctAnswer: "Paris",
      scores: [
        { playerId: "p1", nickname: "Alice", score: 1, connected: true },
      ],
    };
    const state = reducer(undefined, setQuestionResult(result));
    expect(state.lastQuestionResult).toEqual(result);
    expect(state.players[0].score).toBe(1);
    expect(state.roundPhase).toBe("question_result");
  });

  it("setQuestionResult preserves existing scores when payload omits them", () => {
    const initialState = reducer(
      undefined,
      setQuestionResult({
        winnerId: "p1",
        winnerNickname: "Alice",
        correctAnswer: "Paris",
        scores: [
          { playerId: "p1", nickname: "Alice", score: 1, connected: true },
        ],
      }),
    );
    const state = reducer(
      initialState,
      setQuestionResult({
        winnerId: "p1",
        winnerNickname: "Alice",
        correctAnswer: "Paris",
        roundPhase: "question_hype",
        phaseStartedAt: 2000,
      }),
    );

    expect(state.lastQuestionResult.scores).toEqual(
      initialState.lastQuestionResult.scores,
    );
    expect(state.players).toEqual(initialState.players);
    expect(state.roundPhase).toBe("question_hype");
  });

  it("setRoundPhase stores hype phase timing", () => {
    const payload = {
      roundPhase: "question_hype",
      phaseStartedAt: 1000,
      phaseEndsAt: 4000,
    };
    const state = reducer(undefined, setRoundPhase(payload));
    expect(state.roundPhase).toBe("question_hype");
    expect(state.phaseStartedAt).toBe(1000);
    expect(state.phaseEndsAt).toBe(4000);
  });

  it("question:start payload clears hype state", () => {
    const hypeState = reducer(
      undefined,
      setRoundPhase({
        roundPhase: "question_hype",
        phaseStartedAt: 1000,
        phaseEndsAt: 4000,
      }),
    );
    const q = {
      questionNumber: 2,
      totalQuestions: 5,
      question: {},
      timeLimit: 20,
      roundPhase: "question_live",
    };
    const state = reducer(hypeState, setCurrentQuestion(q));
    expect(state.roundPhase).toBe("question_live");
    expect(state.phaseEndsAt).toBeNull();
  });

  it("setHasAnswered sets hasAnswered", () => {
    const state = reducer(undefined, setHasAnswered(true));
    expect(state.hasAnswered).toBe(true);
  });

  it("resetGame returns initial state", () => {
    const dirty = reducer(
      undefined,
      setGame({
        gameId: "abc",
        nickname: "X",
        isHost: true,
        hostToken: "token-123",
      }),
    );
    const reset = reducer(dirty, resetGame());
    expect(reset).toEqual({ ...initial, isHydrated: false });
  });
});
