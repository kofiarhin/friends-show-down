const express = require("express");
const router = express.Router();
const {
  getCurrentWeeklyLeaderboard,
  getWeeklyLeaderboard,
} = require("../store/leaderboardStore");
const { parseWeekId } = require("../utils/weekUtils");

router.get("/weekly", (req, res) => {
  const leaderboard = getCurrentWeeklyLeaderboard();
  return res.json(leaderboard);
});

router.get("/weekly/:weekId", (req, res) => {
  const weekId = parseWeekId(req.params.weekId);
  if (!weekId) {
    return res.status(400).json({ message: "Invalid week ID." });
  }

  const leaderboard = getWeeklyLeaderboard(weekId);
  if (!leaderboard) {
    return res
      .status(404)
      .json({ message: "No leaderboard data for this week." });
  }

  return res.json(leaderboard);
});

module.exports = router;
