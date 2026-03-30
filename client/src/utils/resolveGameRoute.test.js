import { describe, expect, it } from "vitest";
import { resolveGameRoute } from "./resolveGameRoute";

describe("resolveGameRoute", () => {
  it("does not redirect before hydration completes", () => {
    expect(
      resolveGameRoute({
        routeGameId: "ROOM1",
        isHydrated: false,
        status: "waiting",
        nickname: null,
      }),
    ).toBeNull();
  });

  it("redirects hydrated user without nickname to join", () => {
    expect(
      resolveGameRoute({
        routeGameId: "ROOM1",
        isHydrated: true,
        status: "waiting",
        nickname: null,
      }),
    ).toBe("/game/ROOM1/join");
  });

  it("keeps hydrated waiting player in lobby", () => {
    expect(
      resolveGameRoute({
        routeGameId: "ROOM1",
        isHydrated: true,
        status: "waiting",
        nickname: "Host",
      }),
    ).toBe("/game/ROOM1/lobby");
  });
});
