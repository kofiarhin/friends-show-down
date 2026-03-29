const { getGame, getPlayer, addChatMessage } = require("../../store/gameStore");

function registerChatHandlers(io, socket) {
  socket.on("chat:send", (payload) => {
    const parsedPayload = parseChatPayload(payload);
    if (!parsedPayload) {
      return socket.emit("chat:error", {
        code: "invalid_payload",
        message: "Invalid chat payload.",
      });
    }

    const { gameId, message } = parsedPayload;
    const game = getGame(gameId);
    if (!game) {
      return socket.emit("chat:error", {
        code: "game_not_found",
        message: "Game not found.",
      });
    }

    const player = getPlayer(gameId, socket.id);
    if (!player) {
      return socket.emit("chat:error", {
        code: "not_in_game",
        message: "You are not in this game.",
      });
    }

    if (!isChatEnabled(game)) {
      return socket.emit("chat:error", {
        code: "chat_unavailable",
        message: "Chat is not available right now.",
      });
    }

    const chatEntry = {
      message,
      playerId: player.playerId,
      nickname: player.nickname,
      timestamp: Date.now(),
      messageId: generateMessageId(),
    };

    addChatMessage(gameId, chatEntry);
    io.to(gameId).emit("chat:message", chatEntry);
  });
}

function emitChatHistory(socket, game) {
  if (!game?.chatMessages?.length) return;
  socket.emit("chat:history", { messages: game.chatMessages });
}

function isChatEnabled(game) {
  if (game.status === "waiting") return true;
  if (game.status === "ended") return true;
  if (game.status === "in-progress" && game.roundPhase !== "question_live")
    return true;
  return false;
}

function parseChatPayload(payload) {
  if (!isRecord(payload)) return null;
  const gameId = getTrimmedString(payload.gameId);
  const message = getTrimmedString(payload.message);
  if (!gameId || !message || message.length > 250) return null;
  return { gameId, message };
}

function getTrimmedString(value) {
  return typeof value === "string" ? value.trim() : "";
}

function isRecord(value) {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

function generateMessageId() {
  return `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;
}

module.exports = {
  registerChatHandlers,
  emitChatHistory,
};
