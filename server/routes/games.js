const express = require("express");
const router = express.Router();
const { createGame, getGame } = require("../store/gameStore");
const { generateId } = require("../utils/generateId");
const config = require("../config");

// POST /api/games — create a new game session
router.post("/", (req, res) => {
  let gameId;
  do {
    gameId = generateId();
  } while (getGame(gameId));

  createGame(gameId, null); // hostId assigned on socket join

  const gameUrl = `${config.clientUrl}/game/${gameId}/join`;

  return res.status(201).json({ gameId, gameUrl });
});

// GET /api/games/:gameId — validate a game exists and is joinable
router.get("/:gameId", (req, res) => {
  const { gameId } = req.params;
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
  });
});

module.exports = router;
