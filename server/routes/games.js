const express = require("express");
const { randomUUID } = require("crypto");
const router = express.Router();
const { createGame, getGame } = require("../store/gameStore");
const { generateId } = require("../utils/generateId");
const { isValidGenre } = require("../utils/questionBank");
const config = require("../config");

// POST /api/games — create a new game session
router.post("/", (req, res) => {
  if (!isRecord(req.body)) {
    return res.status(400).json({ message: "Invalid request body." });
  }

  const genre = typeof req.body.genre === "string" ? req.body.genre.trim() : "";

  if (!genre) {
    return res.status(400).json({ message: "Genre is required." });
  }
  if (!isValidGenre(genre)) {
    return res.status(400).json({ message: "Invalid genre." });
  }

  let gameId;
  do {
    gameId = generateId();
  } while (getGame(gameId));

  const hostToken = randomUUID().replace(/-/g, "");

  createGame(gameId, null, genre, hostToken); // hostId assigned on socket join

  const gameUrl = `${config.clientUrl}/game/${gameId}/join`;

  return res.status(201).json({ gameId, gameUrl, hostToken });
});

// GET /api/games/:gameId — validate a game exists and is joinable
router.get("/:gameId", (req, res) => {
  const gameId = typeof req.params.gameId === "string" ? req.params.gameId.trim() : "";

  if (!gameId) {
    return res.status(400).json({ message: "Game ID is required." });
  }

  const game = getGame(gameId);

  if (!game) {
    return res.status(404).json({ message: "Game not found." });
  }

  if (game.status === "in-progress" || game.status === "ended") {
    return res.status(409).json({ message: "Game already in progress." });
  }

  return res.json({
    gameId: game.gameId,
    status: game.status,
    playerCount: game.players.length,
    genre: game.config.genre,
  });
});

function isRecord(value) {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

module.exports = router;
