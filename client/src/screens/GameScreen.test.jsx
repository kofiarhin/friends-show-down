import { afterEach, describe, expect, it, vi } from "vitest";
import { Provider } from "react-redux";
import { configureStore } from "@reduxjs/toolkit";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import { act, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import gameReducer from "../store/gameSlice";
import GameScreen from "./GameScreen";

vi.mock("../hooks/useSocketEvents", () => ({
  useSocketEvents: () => {},
}));

const emitMock = vi.fn();
vi.mock("../socket", () => ({
  socket: {
    emit: (...args) => emitMock(...args),
  },
}));

afterEach(() => {
  vi.useRealTimers();
});

function buildState(overrides = {}) {
  return {
    gameId: "ABCD",
    playerId: "p1",
    nickname: "Alice",
    isHost: false,
    genre: "mixed",
    status: "in-progress",
    players: [
      { playerId: "p1", nickname: "Alice", score: 0 },
      { playerId: "p2", nickname: "Bob", score: 1 },
    ],
    currentQuestion: {
      questionNumber: 1,
      totalQuestions: 2,
      question: { prompt: "Question", options: ["A", "B"] },
      timeLimit: 20,
    },
    lastQuestionResult: null,
    roundPhase: "question_live",
    phaseStartedAt: null,
    phaseEndsAt: null,
    hasAnswered: false,
    playState: "running",
    endReason: null,
    lastRoundResults: null,
    startError: null,
    chatMessages: [],
    chatError: null,
    ...overrides,
  };
}

function renderWithState(preloadedState) {
  const store = configureStore({
    reducer: { game: gameReducer },
    preloadedState: { game: preloadedState },
  });

  return {
    store,
    ...render(
      <Provider store={store}>
        <MemoryRouter initialEntries={["/game/ABCD/play"]}>
          <Routes>
            <Route path="/game/:gameId/play" element={<GameScreen />} />
          </Routes>
        </MemoryRouter>
      </Provider>,
    ),
  };
}

describe("GameScreen gameplay states", () => {
  it("renders a 3, 2, 1 hype countdown sequence", () => {
    vi.useFakeTimers();
    const now = new Date("2026-03-30T12:00:00.000Z");
    vi.setSystemTime(now);

    renderWithState(
      buildState({
        lastQuestionResult: {
          winnerNickname: "Bob",
          correctAnswer: "A",
          scores: [],
          roundPhase: "question_result",
        },
        roundPhase: "question_hype",
        phaseStartedAt: now.getTime(),
        phaseEndsAt: now.getTime() + 3000,
      }),
    );

    expect(screen.getByText("Get ready...")).toBeInTheDocument();
    expect(screen.getByTestId("hype-countdown-display")).toHaveTextContent("3");

    act(() => {
      vi.advanceTimersByTime(1000);
    });
    expect(screen.getByTestId("hype-countdown-display")).toHaveTextContent("2");

    act(() => {
      vi.advanceTimersByTime(1000);
    });
    expect(screen.getByTestId("hype-countdown-display")).toHaveTextContent("1");
  });

  it("disables answer submission during hype", async () => {
    emitMock.mockReset();

    renderWithState(
      buildState({
        lastQuestionResult: {
          winnerNickname: "Bob",
          correctAnswer: "A",
          scores: [],
          roundPhase: "question_result",
        },
        roundPhase: "question_hype",
        phaseStartedAt: Date.now(),
        phaseEndsAt: Date.now() + 2500,
      }),
    );

    const button = screen.getByRole("button", { name: "A" });
    expect(button).toBeDisabled();

    await userEvent.click(button);
    expect(emitMock).not.toHaveBeenCalled();
  });

  it("locks the selected answer immediately after submission", async () => {
    emitMock.mockReset();

    renderWithState(buildState());

    const selectedButton = screen.getByRole("button", { name: "A" });
    const otherButton = screen.getByRole("button", { name: "B" });

    await userEvent.click(selectedButton);

    expect(emitMock).toHaveBeenCalledWith("answer:submit", {
      gameId: "ABCD",
      questionNumber: 1,
      answer: "A",
    });
    expect(selectedButton).toHaveAttribute("data-answer-state", "selected");
    expect(otherButton).toHaveAttribute("data-answer-state", "locked");
  });

  it("opens and closes the chat drawer", async () => {
    renderWithState(buildState());

    const chatToggle = screen.getByRole("button", { name: /chat/i });
    await userEvent.click(chatToggle);

    const closeButtons = screen.getAllByRole("button", { name: /close/i });
    expect(closeButtons.length).toBeGreaterThan(0);

    await userEvent.click(closeButtons[0]);
    expect(
      screen.queryByRole("button", { name: /close/i }),
    ).not.toBeInTheDocument();
  });

  it("shows the paused overlay state for players", () => {
    renderWithState(buildState({ playState: "paused" }));

    expect(screen.getByTestId("pause-overlay")).toHaveAttribute(
      "data-visible",
      "true",
    );
    expect(screen.getByText("Game Paused")).toBeInTheDocument();
  });
});
