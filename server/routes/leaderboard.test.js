const request = require("supertest");
const app = require("../app");
const {
  recordCompletedGame,
  clearLeaderboards,
  getWeeklyLeaderboard,
} = require("../store/leaderboardStore");

describe("GET /api/leaderboard/weekly", () => {
  beforeEach(() => {
    clearLeaderboards();
  });

  it("returns the current week and an empty entries array when no games exist", async () => {
    const res = await request(app).get("/api/leaderboard/weekly");

    expect(res.status).toBe(200);
    expect(res.body).toHaveProperty("weekId");
    expect(res.body.entries).toEqual([]);
  });

  it("returns aggregated leaderboard data for the current week", async () => {
    const game = {
      status: "ended",
      endReason: "completed",
      players: [
        { playerId: "a1", nickname: "Alice", score: 6 },
        { playerId: "b1", nickname: "Bob", score: 2 },
      ],
      lastRoundResults: {
        winnerId: "a1",
      },
    };

    recordCompletedGame(game);

    const res = await request(app).get("/api/leaderboard/weekly");

    expect(res.status).toBe(200);
    expect(res.body.entries).toHaveLength(2);
    expect(res.body.entries[0].playerName).toBe("Alice");
  });
});

describe("GET /api/leaderboard/weekly/:weekId", () => {
  beforeEach(() => {
    clearLeaderboards();
  });

  it("returns 400 for an invalid week ID", async () => {
    const res = await request(app).get("/api/leaderboard/weekly/invalid-week");
    expect(res.status).toBe(400);
    expect(res.body).toEqual({ message: "Invalid week ID." });
  });

  it("returns 404 when a valid historical week has no data", async () => {
    const res = await request(app).get("/api/leaderboard/weekly/2025-01");
    expect(res.status).toBe(404);
    expect(res.body).toEqual({ message: "No leaderboard data for this week." });
  });

  it("returns leaderboard data for a valid week ID", async () => {
    const game = {
      status: "ended",
      endReason: "completed",
      players: [{ playerId: "x1", nickname: "Xena", score: 8 }],
      lastRoundResults: {
        winnerId: "x1",
      },
    };

    recordCompletedGame(game);
    const current = await request(app).get("/api/leaderboard/weekly");

    const res = await request(app).get(
      `/api/leaderboard/weekly/${current.body.weekId}`,
    );

    expect(res.status).toBe(200);
    expect(res.body.weekId).toBe(current.body.weekId);
    expect(res.body.entries[0]).toMatchObject({ playerName: "Xena", score: 8 });
  });
});
