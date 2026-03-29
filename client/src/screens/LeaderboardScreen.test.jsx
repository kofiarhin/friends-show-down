import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { MemoryRouter } from "react-router-dom";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import LeaderboardScreen from "./LeaderboardScreen";

vi.mock("../config", () => ({
  apiBase: "",
}));

function renderLeaderboard() {
  return render(
    <MemoryRouter>
      <LeaderboardScreen />
    </MemoryRouter>,
  );
}

describe("LeaderboardScreen", () => {
  beforeEach(() => {
    vi.stubGlobal("fetch", vi.fn());
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("loads the current weekly leaderboard on mount", async () => {
    fetch.mockResolvedValueOnce({
      ok: true,
      json: async () => ({ weekId: "2026-13", entries: [] }),
    });

    renderLeaderboard();

    await waitFor(() => {
      expect(fetch).toHaveBeenCalledWith("/api/leaderboard/weekly");
    });

    expect(
      screen.getByText("No leaderboard data is available for this week."),
    ).toBeInTheDocument();
  });

  it("shows leaderboard entries when available", async () => {
    fetch.mockResolvedValueOnce({
      ok: true,
      json: async () => ({
        weekId: "2026-13",
        entries: [
          { rank: 1, playerName: "Alice", score: 8, wins: 1, gamesPlayed: 1 },
        ],
      }),
    });

    renderLeaderboard();

    await waitFor(() => {
      expect(screen.getByText("Alice")).toBeInTheDocument();
    });

    expect(screen.getByRole("cell", { name: "Alice" })).toBeInTheDocument();
    expect(screen.getByRole("cell", { name: "8" })).toBeInTheDocument();
    expect(
      screen.getAllByRole("cell", { name: "1" }).length,
    ).toBeGreaterThanOrEqual(1);
  });

  it("shows an error when the week ID is invalid", async () => {
    fetch.mockResolvedValueOnce({
      ok: true,
      json: async () => ({ weekId: "2026-13", entries: [] }),
    });
    fetch.mockResolvedValueOnce({
      ok: false,
      status: 400,
      json: async () => ({ message: "Invalid week ID." }),
    });

    const user = userEvent.setup();
    renderLeaderboard();

    await waitFor(() => {
      expect(fetch).toHaveBeenCalledTimes(1);
    });

    await user.type(
      screen.getByPlaceholderText("Enter week ID (e.g. 2026-13)"),
      "invalid-week",
    );
    await user.click(screen.getByRole("button", { name: "Load leaderboard" }));

    await waitFor(() => {
      expect(
        screen.getAllByText("Invalid week ID.").length,
      ).toBeGreaterThanOrEqual(1);
    });
  });
});
