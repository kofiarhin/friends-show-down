import { describe, it, expect, vi } from "vitest";
import { Provider } from "react-redux";
import { configureStore } from "@reduxjs/toolkit";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import { render, screen } from "@testing-library/react";
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

function renderWithState(preloadedState) {
  const store = configureStore({
    reducer: { game: gameReducer },
    preloadedState: { game: preloadedState },
  });

  return render(
    <Provider store={store}>
      <MemoryRouter initialEntries={["/game/ABCD/play"]}>
        <Routes>
          <Route path="/game/:gameId/play" element={<GameScreen />} />
        </Routes>
      </MemoryRouter>
    </Provider>
  );
}

describe("GameScreen hype phase", () => {
  it("renders hype countdown text", () => {
    const now = Date.now();
    renderWithState({
      gameId: "ABCD",
      playerId: "p1",
      nickname: "Alice",
      isHost: false,
      genre: "mixed",
      status: "in-progress",
      players: [],
      currentQuestion: {
        questionNumber: 1,
        totalQuestions: 2,
        question: { prompt: "Question", options: ["A", "B"] },
        timeLimit: 20,
      },
      lastQuestionResult: {
        winnerNickname: "Bob",
        correctAnswer: "A",
        scores: [],
        roundPhase: "question_result",
      },
      roundPhase: "question_hype",
      phaseStartedAt: now,
      phaseEndsAt: now + 2500,
      hasAnswered: false,
      playState: "running",
      endReason: null,
      lastRoundResults: null,
      startError: null,
    });

    expect(screen.getByText("Get ready…")).toBeInTheDocument();
  });

  it("disables answer submission during hype", async () => {
    emitMock.mockReset();
    renderWithState({
      gameId: "ABCD",
      playerId: "p1",
      nickname: "Alice",
      isHost: false,
      genre: "mixed",
      status: "in-progress",
      players: [],
      currentQuestion: {
        questionNumber: 1,
        totalQuestions: 2,
        question: { prompt: "Question", options: ["A", "B"] },
        timeLimit: 20,
      },
      lastQuestionResult: {
        winnerNickname: "Bob",
        correctAnswer: "A",
        scores: [],
        roundPhase: "question_result",
      },
      roundPhase: "question_hype",
      phaseStartedAt: Date.now(),
      phaseEndsAt: Date.now() + 2500,
      hasAnswered: false,
      playState: "running",
      endReason: null,
      lastRoundResults: null,
      startError: null,
    });

    const button = screen.getByRole("button", { name: "A" });
    expect(button).toBeDisabled();

    await userEvent.click(button);
    expect(emitMock).not.toHaveBeenCalled();
  });
});
