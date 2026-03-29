const { getCurrentUtcWeekId } = require("../utils/weekUtils");

const leaderboards = new Map();

function buildLeaderboardEntries(weekId, entries) {
  const sorted = [...entries.values()].sort((a, b) => {
    if (b.score !== a.score) return b.score - a.score;
    if (b.wins !== a.wins) return b.wins - a.wins;
    if (a.gamesPlayed !== b.gamesPlayed) return a.gamesPlayed - b.gamesPlayed;
    return a.playerName.localeCompare(b.playerName);
  });

  let rank = 0;
  let previousScore = null;
  let position = 0;

  return sorted.map((entry) => {
    position += 1;
    if (entry.score !== previousScore) {
      rank = position;
      previousScore = entry.score;
    }

    return {
      weekId,
      playerName: entry.playerName,
      score: entry.score,
      wins: entry.wins,
      gamesPlayed: entry.gamesPlayed,
      rank,
    };
  });
}

function getWeeklyLeaderboard(weekId) {
  if (typeof weekId !== "string") return null;
  const weekData = leaderboards.get(weekId);
  if (!weekData) return null;
  return {
    weekId,
    entries: buildLeaderboardEntries(weekId, weekData),
  };
}

function getCurrentWeeklyLeaderboard() {
  const weekId = getCurrentUtcWeekId();
  const leaderboard = getWeeklyLeaderboard(weekId);
  if (!leaderboard) {
    return { weekId, entries: [] };
  }
  return leaderboard;
}

function recordCompletedGame(game) {
  if (!game || game.status !== "ended" || game.endReason !== "completed") {
    return false;
  }
  if (!Array.isArray(game.players) || !game.lastRoundResults) {
    return false;
  }

  const weekId = getCurrentUtcWeekId();
  let weekData = leaderboards.get(weekId);
  if (!weekData) {
    weekData = new Map();
    leaderboards.set(weekId, weekData);
  }

  for (const player of game.players) {
    const playerName =
      typeof player.nickname === "string" ? player.nickname : "Unknown";
    const existing = weekData.get(playerName) || {
      playerName,
      score: 0,
      wins: 0,
      gamesPlayed: 0,
    };

    existing.score += Number.isFinite(player.score) ? player.score : 0;
    existing.gamesPlayed += 1;
    if (player.playerId === game.lastRoundResults.winnerId) {
      existing.wins += 1;
    }

    weekData.set(playerName, existing);
  }

  return true;
}

function clearLeaderboards() {
  leaderboards.clear();
}

module.exports = {
  getWeeklyLeaderboard,
  getCurrentWeeklyLeaderboard,
  recordCompletedGame,
  clearLeaderboards,
};
