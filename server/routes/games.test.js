const request = require("supertest");
const app = require("../app");
const { getGame, deleteGame } = require("../store/gameStore");

describe("POST /api/games", () => {
  it("returns 201 with gameId, gameUrl, and hostToken", async () => {
    const res = await request(app).post("/api/games").send({ genre: "mixed" });
    expect(res.status).toBe(201);
    expect(res.body).toHaveProperty("gameId");
    expect(res.body).toHaveProperty("gameUrl");
    expect(res.body).toHaveProperty("hostToken");
    expect(res.body.gameUrl).toContain(res.body.gameId);

    deleteGame(res.body.gameId);
  });

  it("returns 400 when genre is missing", async () => {
    const res = await request(app).post("/api/games").send({});

    expect(res.status).toBe(400);
    expect(res.body).toEqual({ message: "Genre is required." });
  });

  it("returns 400 for an invalid genre", async () => {
    const res = await request(app).post("/api/games").send({ genre: "unknown" });

    expect(res.status).toBe(400);
    expect(res.body).toEqual({ message: "Invalid genre." });
  });

  it("returns 400 for malformed JSON", async () => {
    const res = await request(app)
      .post("/api/games")
      .set("Content-Type", "application/json")
      .send('{"genre":');

    expect(res.status).toBe(400);
    expect(res.body).toEqual({ message: "Malformed JSON." });
  });
});

describe("GET /api/games/:gameId", () => {
  let gameId;

  beforeEach(async () => {
    const res = await request(app).post("/api/games").send({ genre: "mixed" });
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
