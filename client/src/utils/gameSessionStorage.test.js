import { beforeEach, describe, expect, it } from "vitest";
import {
  loadGameSession,
  persistGameSession,
  clearGameSession,
  SESSION_STORAGE_KEY,
} from "./gameSessionStorage";

describe("gameSessionStorage", () => {
  beforeEach(() => {
    sessionStorage.clear();
  });

  it("persists and restores host session in same tab", () => {
    persistGameSession({
      gameId: "ROOM1",
      nickname: "Host",
      isHost: true,
      hostToken: "token-1",
      status: "waiting",
      genre: "science",
    });

    expect(loadGameSession()).toEqual({
      gameId: "ROOM1",
      nickname: "Host",
      isHost: true,
      hostToken: "token-1",
      status: "waiting",
      genre: "science",
    });
  });

  it("clears persisted session when required fields are missing", () => {
    persistGameSession({ gameId: "ROOM1", nickname: null });

    expect(sessionStorage.getItem(SESSION_STORAGE_KEY)).toBeNull();
    expect(loadGameSession()).toBeNull();
  });

  it("clearGameSession removes persisted data", () => {
    persistGameSession({
      gameId: "ROOM1",
      nickname: "Player",
      isHost: false,
      status: "waiting",
      genre: null,
    });

    clearGameSession();

    expect(loadGameSession()).toBeNull();
  });
});
