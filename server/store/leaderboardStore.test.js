const {
  getCurrentWeeklyLeaderboard,
  getWeeklyLeaderboard,
  recordCompletedGame,
  clearLeaderboards,
} = require("./leaderboardStore");
const { parseWeekId, getCurrentUtcWeekId } = require("../utils/weekUtils");

describe("leaderboardStore", () => {
  beforeEach(() => {
    clearLeaderboards();
  });

  it("returns an empty leaderboard for the current week when no games are recorded", () => {
    const current = getCurrentWeeklyLeaderboard();
    expect(current.weekId).toBe(getCurrentUtcWeekId());
    expect(current.entries).toEqual([]);
  });

  it("records a completed game and aggregates player stats", () => {
    const game = {
      status: "ended",
      endReason: "completed",
      players: [
        { playerId: "p1", nickname: "Alice", score: 5 },
        { playerId: "p2", nickname: "Bob", score: 3 },
      ],
      lastRoundResults: {
        winnerId: "p1",
      },
    };

    expect(recordCompletedGame(game)).toBe(true);

    const currentWeekId = getCurrentUtcWeekId();
    const leaderboard = getWeeklyLeaderboard(currentWeekId);

    expect(leaderboard).not.toBeNull();
    expect(leaderboard.weekId).toBe(currentWeekId);
    expect(leaderboard.entries).toEqual([
      {
        weekId: currentWeekId,
        playerName: "Alice",
        score: 5,
        wins: 1,
        gamesPlayed: 1,
        rank: 1,
      },
      {
        weekId: currentWeekId,
        playerName: "Bob",
        score: 3,
        wins: 0,
        gamesPlayed: 1,
        rank: 2,
      },
    ]);
  });

  it("uses stable ranking for tie scores", () => {
    const game = {
      status: "ended",
      endReason: "completed",
      players: [
        { playerId: "p1", nickname: "Alice", score: 4 },
        { playerId: "p2", nickname: "Bob", score: 4 },
      ],
      lastRoundResults: {
        winnerId: null,
      },
    };

    recordCompletedGame(game);
    const leaderboard = getWeeklyLeaderboard(getCurrentUtcWeekId());

    expect(leaderboard.entries[0].rank).toBe(1);
    expect(leaderboard.entries[1].rank).toBe(1);
  });

  it("parses valid and invalid week IDs", () => {
    expect(parseWeekId("2025-01")).toBe("2025-01");
    expect(parseWeekId(" 2025-01 ")).toBe("2025-01");
    expect(parseWeekId("2025-00")).toBeNull();
    expect(parseWeekId("2025-54")).toBeNull();
    expect(parseWeekId("invalid")).toBeNull();
  });
});
