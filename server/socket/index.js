const { registerGameHandlers, sanitizePlayers } = require("./handlers/gameHandlers");
const { registerQuestionHandlers } = require("./handlers/questionHandlers");
const {
  getGame,
  markDisconnected,
  deleteGame,
  setExpiryTimer,
} = require("../store/gameStore");

const WAITING_EXPIRY_MS = 30 * 60 * 1000;

function initSocket(io) {
  io.on("connection", (socket) => {
    registerGameHandlers(io, socket);
    registerQuestionHandlers(io, socket);

    socket.on("disconnect", () => {
      // Find the game this socket belongs to by scanning rooms
      for (const [gameId, game] of getAllGames()) {
        const player = game.players.find((p) => p.playerId === socket.id);
        if (!player) continue;

        markDisconnected(gameId, socket.id);

        if (game.status === "waiting") {
          const isHost = game.hostId === socket.id;
          if (isHost) {
            // Host disconnected in lobby — close the session
            io.to(gameId).emit("game:closed", { reason: "Host disconnected." });
            deleteGame(gameId);
          } else {
            io.to(gameId).emit("lobby:updated", {
              players: sanitizePlayers(game.players),
            });
            setExpiryTimer(gameId, WAITING_EXPIRY_MS);
          }
        } else if (game.status === "in-progress") {
          io.to(gameId).emit("players:updated", {
            players: sanitizePlayers(game.players),
          });
        }
        break;
      }
    });
  });
}

function getAllGames() {
  // Access the internal Map via the store module
  const store = require("../store/gameStore");
  return store._games || new Map();
}

module.exports = { initSocket };
