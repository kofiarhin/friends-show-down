const SESSION_STORAGE_KEY = "fsd:activeSession";

function getSessionStorage() {
  if (typeof window === "undefined" || !window.sessionStorage) {
    return null;
  }
  return window.sessionStorage;
}

function sanitizeString(value) {
  if (typeof value !== "string") return null;
  const trimmed = value.trim();
  return trimmed ? trimmed : null;
}

function sanitizeStatus(value) {
  return ["idle", "waiting", "in-progress", "ended"].includes(value)
    ? value
    : "idle";
}

export function loadGameSession() {
  const storage = getSessionStorage();
  if (!storage) return null;

  const raw = storage.getItem(SESSION_STORAGE_KEY);
  if (!raw) return null;

  try {
    const parsed = JSON.parse(raw);
    if (!parsed || typeof parsed !== "object") return null;

    const gameId = sanitizeString(parsed.gameId);
    const nickname = sanitizeString(parsed.nickname);
    if (!gameId || !nickname) return null;

    const isHost = parsed.isHost === true;
    const hostToken = isHost ? sanitizeString(parsed.hostToken) : null;

    return {
      gameId,
      gameUrl: sanitizeString(parsed.gameUrl),
      nickname,
      isHost,
      hostToken,
      status: sanitizeStatus(parsed.status),
      genre: sanitizeString(parsed.genre),
    };
  } catch {
    return null;
  }
}

export function persistGameSession(gameState) {
  const storage = getSessionStorage();
  if (!storage) return;

  const gameId = sanitizeString(gameState?.gameId);
  const nickname = sanitizeString(gameState?.nickname);

  if (!gameId || !nickname) {
    storage.removeItem(SESSION_STORAGE_KEY);
    return;
  }

  const payload = {
    gameId,
    gameUrl: sanitizeString(gameState?.gameUrl),
    nickname,
    isHost: gameState?.isHost === true,
    hostToken:
      gameState?.isHost === true ? sanitizeString(gameState?.hostToken) : null,
    status: sanitizeStatus(gameState?.status),
    genre: sanitizeString(gameState?.genre),
  };

  storage.setItem(SESSION_STORAGE_KEY, JSON.stringify(payload));
}

export function clearGameSession() {
  const storage = getSessionStorage();
  if (!storage) return;
  storage.removeItem(SESSION_STORAGE_KEY);
}

export { SESSION_STORAGE_KEY };
