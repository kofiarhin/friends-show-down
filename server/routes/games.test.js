const request = require("supertest");
const app = require("../app");
const { getGame, deleteGame } = require("../store/gameStore");

describe("POST /api/games", () => {
  it("returns 201 with gameId and gameUrl", async () => {
    const res = await request(app).post("/api/games");
    expect(res.status).toBe(201);
    expect(res.body).toHaveProperty("gameId");
    expect(res.body).toHaveProperty("gameUrl");
    expect(res.body.gameUrl).toContain(res.body.gameId);

    deleteGame(res.body.gameId);
  });
});

describe("GET /api/games/:gameId", () => {
  let gameId;

  beforeEach(async () => {
    const res = await request(app).post("/api/games");
    gameId = res.body.gameId;
  });

  afterEach(() => {
    deleteGame(gameId);
  });

  it("returns 200 with game info for a valid waiting game", async () => {
    const res = await request(app).get(`/api/games/${gameId}`);
    expect(res.status).toBe(200);
    expect(res.body.gameId).toBe(gameId);
    expect(res.body.status).toBe("waiting");
  });

  it("returns 404 for an unknown gameId", async () => {
    const res = await request(app).get("/api/games/doesnotexist");
    expect(res.status).toBe(404);
  });

  it("returns 409 for an in-progress game", async () => {
    const game = getGame(gameId);
    game.status = "in-progress";

    const res = await request(app).get(`/api/games/${gameId}`);
    expect(res.status).toBe(409);
  });
});
