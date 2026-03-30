# Production Room Lifecycle Fix Plan

**Scope:** Fix host disconnect destroying waiting rooms before invited players can join
**Status:** Planning only — no code changes in this document
**Date:** 2026-03-30
**Validated against:** actual repo files listed in §2

---

## 1. Root Cause Confirmation

### The Bug Path (exact file/line references)

**Step 1 — Room is created**
`server/routes/games.js:10-36` — `POST /api/games` creates a game via `createGame(gameId, null, genre, hostToken)`. The game is stored with `status: "waiting"` and `hostId: null`. A `hostToken` is generated at line 29: `randomUUID().replace(/-/g, "")` — 32-character hex, 128-bit entropy. The token is returned in the response body. `hostId` is `null` at this point; it is assigned only after `game:join` is emitted by the host's socket.

**Step 2 — Host stores token and navigates to join screen**
`client/src/screens/HomeScreen.jsx:42-53` — `onSuccess` dispatches `setGame({ gameId, isHost: true, hostToken, genre })` to Redux. The host navigates to `/game/:gameId/join`. Token exists in Redux memory only at this point — it is not written to `localStorage`.

**Step 3 — Host shares the link**
On mobile (iOS Safari, Android Chrome), sharing the URL may background the tab or trigger a brief socket reconnect cycle.

**Step 4 — Socket disconnect fires**
`server/socket/index.js:22-58` — The `disconnect` handler scans all games via `getAllGames()` (line 63-67 — uses `require` inside function to access `store._games`, which is fragile but functional). It finds the player by `p.playerId === socket.id` (line 25). If the host has already emitted `game:join` and is in `game.players`, the handler continues:

```
// server/socket/index.js:30-35
if (game.status === "waiting") {
  const isHost = game.hostId === socket.id;
  if (isHost) {
    io.to(gameId).emit("game:closed", { reason: "Host disconnected." });
    deleteGame(gameId);   // ← ROOM DESTROYED IMMEDIATELY HERE
  }
  ...
}
```

6. The room is **immediately deleted** from the in-memory `Map`.
7. The invited player opens the shared link → `GET /api/games/:gameId` → `404` → "Game not found. Redirecting..."

**Note on the pre-join case:** If the host backgrounds the app *before* submitting the join form, `game:join` has not been emitted, no player entry exists, and `break` is never reached — the room survives. This scenario already works. The bug only applies when the host has already joined the socket room.

### Why the Existing Reconnect Logic Doesn't Save It

`server/socket/handlers/gameHandlers.js:146-168` already has a waiting-state reconnect path. It finds the player by nickname, validates the `hostToken`, updates `game.hostId`, calls `clearExpiryTimer`, and emits `lobby:updated`. However, this code is **unreachable** because `deleteGame` is called in the disconnect handler before any reconnect can occur. The reconnect path is structurally correct for its purpose but depends on the room still existing.

### Why `hostToken` Infrastructure Doesn't Help (Yet)

The token machinery is partially in place:
- Token generated: `routes/games.js:29`
- Stored on game object: `gameStore.js:3,6,8` (field `hostToken`)
- Client receives and stores in Redux: `gameSlice.js` field `hostToken`; `HomeScreen.jsx:47`
- Client sends token on join: `NameEntryScreen.jsx:91-92` (when `isHost && hostToken`)
- Server validates on reconnect: `gameHandlers.js:41-43`

All of this is moot because the room is deleted before reconnect is possible.

### Secondary Bug: Token Lost on Page Refresh

`hostToken` exists only in Redux, which is not persisted to storage. A page refresh clears it. On the next `game:join` emission, `payload.hostToken` is `null`, and `gameHandlers.js:149-153` rejects the reconnect:
```
if (wasHost && !hasValidHostToken) {
  return socket.emit("join:error", {
    message: "Host reconnection requires a valid host token.",
  });
}
```

### Tertiary Bug: LobbyScreen Has No Socket Reconnect Handling

When the host's socket disconnects and reconnects while they are on `LobbyScreen.jsx`, the following happens:
- Socket.IO issues a new `socket.id`
- `useSocketEvents.js:31-33` fires `onConnect → dispatch(setPlayerId(socket.id))` (updates Redux)
- But `game:join` is **never re-emitted** — no code does this
- The server still holds the old `socket.id` as `game.hostId`
- When the host clicks "Start Game": `socket.emit("game:start", { gameId })` → `gameHandlers.js:217` checks `game.hostId !== socket.id` → silent failure (no event emitted)

The host is effectively a ghost — they can see the lobby UI but their socket actions don't register. The same applies to non-host players reconnecting from the lobby. `LobbyScreen.jsx` must detect socket reconnect and trigger a re-join.

---

## 2. Affected Files

### Server

| File | Change type |
|---|---|
| `server/socket/index.js` | Core fix — change disconnect handler for `waiting + isHost` case; define `HOST_RECONNECT_MS` |
| `server/store/gameStore.js` | Add `hostDisconnectedAt: null` field to game object in `createGame` |
| `server/socket/handlers/gameHandlers.js` | Reconnect path (lines 146-168): add `hostDisconnectedAt` reset; add `host:reconnected` emission |

### Client

| File | Change type |
|---|---|
| `client/src/screens/HomeScreen.jsx` | Persist `hostToken` + `gameId` to `localStorage` on game creation |
| `client/src/screens/NameEntryScreen.jsx` | Read `hostToken` from `localStorage` on mount if Redux state is missing it |
| `client/src/screens/LobbyScreen.jsx` | Handle socket `connect` event — detect reconnect and trigger re-join or navigate to join screen |
| `client/src/hooks/useSocketEvents.js` | Add handlers for `host:offline` and `host:reconnected` |
| `client/src/store/gameSlice.js` | Add `hostOffline: false` state field and `setHostOffline` reducer |

### No changes needed

| File | Reason |
|---|---|
| `server/routes/games.js` | Already generates and returns `hostToken` correctly; `GET /:gameId` needs no change |
| `server/socket/handlers/questionHandlers.js` | Unaffected |
| `server/store/leaderboardStore.js` | Unaffected |

---

## 3. Proposed Lifecycle

### Waiting Lobby

| Event | Current behaviour | Desired behaviour |
|---|---|---|
| Room created | `status: "waiting"`, `hostId: null` | Same |
| Host emits `game:join` | `hostId` set to `socket.id`; player added | Same |
| Non-host player joins | Added to players; `lobby:updated` emitted | Same |
| **Host disconnects** | **`game:closed` emitted; `deleteGame` called immediately** | Mark host player disconnected; set `hostDisconnectedAt = Date.now()`; start `HOST_RECONNECT_MS` (10 min) timer; emit `host:offline` to room |
| Host reconnects within 10 min | n/a (room was deleted) | Validate `hostToken`; update `game.hostId` to new `socket.id`; set `player.connected = true`; reset `hostDisconnectedAt = null`; cancel expiry timer; emit `host:reconnected` + `lobby:updated` to room |
| Host fails to reconnect before expiry | n/a | Timer callback: emit `game:closed { reason: "host_timeout" }`; call `deleteGame` |
| Non-host disconnects in waiting | `markDisconnected`; `lobby:updated`; 30-min expiry timer set | Same — unchanged |
| Non-host reconnects in waiting | Supported via `game:join` reconnect path (lines 146-168) | Same — but LobbyScreen must re-emit `game:join` on socket reconnect |

### Timer Constants — Naming

Two distinct timer constants must coexist:

| Constant | Value | Location | Purpose |
|---|---|---|---|
| `WAITING_EXPIRY_MS` | `30 * 60 * 1000` | `socket/index.js:14` and `gameHandlers.js:21` (both exist already) | Room expiry when a non-host disconnects or when host reconnects successfully |
| `HOST_RECONNECT_MS` | `10 * 60 * 1000` | **New** — define in `socket/index.js` | Grace period before deleting a room whose host has disconnected |

`HOST_RECONNECT_MS` must be a new separate constant. Do not modify or reuse `WAITING_EXPIRY_MS`.

### In-Progress

| Event | Current behaviour | Desired behaviour |
|---|---|---|
| Host disconnects (paused) | `game:closed` + `deleteGame` immediately | No change in Phase 1 |
| Host disconnects (running) | `players:updated` emitted | No change in Phase 1 |

### Game Ended

No changes needed. `ENDED_EXPIRY_MS = 15 min` (defined in `gameHandlers.js:23`) is appropriate.

---

## 4. In-Memory Data Model Changes

### New Field on the Game Object (`server/store/gameStore.js`)

```
hostDisconnectedAt: null     // timestamp (ms) when host last disconnected in waiting; null when connected
```

Add to the object literal in `createGame` (line 3-36). No other fields needed.

**Do not add `expiresAt`.** The expiry is already tracked by the `game.expiryTimer` reference (line 33). A parallel timestamp is useful for debugging but not critical for Phase 1.

**Do not add a `hostConnected` boolean.** It is derivable from `game.players.find(p => p.playerId === game.hostId)?.connected`. Avoid redundant state.

### Where Timers Should Live

Keep timers in the **store layer** via the existing `setExpiryTimer` / `clearExpiryTimer` helpers (`gameStore.js:122-138`). The socket layer calls these with an `onExpire` callback — it does not manage raw `setTimeout` calls directly.

`setExpiryTimer` already supports `onExpire`:
```
// gameStore.js:122-130
function setExpiryTimer(gameId, ms, onExpire) { ... }
```

The `onExpire` callback passed from `socket/index.js` is where `io.to(gameId).emit("game:closed", ...)` should live.

### `hostDisconnectedAt` Reset Point

`game.hostDisconnectedAt` must be reset to `null` in `gameHandlers.js` in the waiting-state reconnect branch (currently lines 155-168). This is the only place where a returning host's state is reconciled.

---

## 5. Socket Event Changes

### Events to Change

| Event | Current behaviour | Required change |
|---|---|---|
| `game:closed` on host disconnect (waiting) | Emitted immediately in `socket/index.js:34` | **Remove from disconnect handler.** `game:closed` should only fire from the expiry timer callback or from explicit host actions (`game:end-early`, `game:leave`). |

### New Events to Add

| Event | Direction | Payload | Purpose |
|---|---|---|---|
| `host:offline` | Server → Client | `{ reason: "disconnected" }` | Notify waiting players that host temporarily lost connection; client shows a non-destructive banner |
| `host:reconnected` | Server → Client | `{ players: [...] }` | Notify all players host is back; client dismisses offline banner |

`host:reconnected` must be emitted from `gameHandlers.js` in the waiting reconnect path (lines 146-168). **This emission does not currently exist there** — only `lobby:updated` is emitted (line 164). Both should be emitted after a successful host reconnect.

### Events to Reuse Without Change

| Event | Notes |
|---|---|
| `lobby:updated` | Already emitted on host reconnect at `gameHandlers.js:164`. Emit this alongside `host:reconnected`; both serve different client purposes. |
| `game:closed` | Still used for: expiry timeout (new: `reason: "host_timeout"`), explicit cancel (`reason: "host_ended"`), explicit leave (`reason: "host_left"`). |
| `join:error` | Unchanged — returned when game not found or token invalid. |

### `onGameClosed` Handler Is Reason-Blind

`useSocketEvents.js:98-101`:
```js
function onGameClosed() {   // ← takes no arguments; ignores payload
  dispatch(resetGame());
  navigate("/");
}
```
The handler currently ignores the `reason` field from the server payload. If per-reason messaging is wanted (e.g., "The host's session expired" vs "The host left"), this handler must be updated to accept and use the payload. This is acceptable for Phase 2 since the base redirect behaviour is correct.

---

## 6. Client Flow Changes

### Room Creation (`HomeScreen.jsx`)

Currently: `hostToken` dispatched to Redux only (`HomeScreen.jsx:47`).

Required change: After `POST /api/games` succeeds and before `navigate(...)`, write the token to `localStorage`:
```
localStorage.setItem(`fsd:hostToken:${gameId}`, hostToken)
```
Use a namespaced key to avoid collisions. Remove any previously stored `fsd:hostToken:*` entries on new game creation to prevent accumulation. Do not write to URL — it appears in browser history and server logs.

### Token Recovery on Join Screen (`NameEntryScreen.jsx`)

Currently: `hostToken` is read from Redux via `useSelector` (line 23-26). If Redux was cleared by a page refresh, `hostToken` is `null`.

Required change: In a `useEffect` on mount, if `isHost` is true but `hostToken` is falsy, attempt `localStorage.getItem("fsd:hostToken:<gameId>")`. If found, dispatch `setGame({ hostToken })` to restore it. This ensures the `game:join` payload (line 91-92) includes the token.

### Lobby Reconnect Handling (`LobbyScreen.jsx` — new requirement)

Currently: `LobbyScreen.jsx` has NO socket reconnect handling. When the socket reconnects (new `socket.id` assigned), the host and players are ghosts — their socket actions are rejected by the server because the old `socket.id` no longer maps to any game.

Required change: `LobbyScreen.jsx` must listen for the socket `connect` event (fired on reconnect by Socket.IO). On reconnect, the previous `socket.id` is stale. The component should check `isConnectedToGame` (does `game.players` include the current `socket.id`?) and, if not, either:

- **Option A (simpler):** Navigate to `/game/:gameId/join` automatically, prompting the user to re-enter their name. This reuses the existing join + reconnect flow in `gameHandlers.js:146-168`.
- **Option B (better UX):** Re-emit `game:join` automatically with the nickname and `hostToken` already held in Redux, without user interaction. This requires the lobby to hold nickname + token in accessible state (they are available in Redux `game.nickname` and `game.hostToken`).

Option B is preferable for the host specifically (token is in Redux). For non-host players in the lobby, Option A is fine (they just re-enter their nickname). The decision can be made at implementation time, but the behaviour must be defined before coding.

### Socket Reconnect (`socket.js`)

`socket.js:4-7` — `autoConnect: true` and `transports: ["websocket", "polling"]`. The socket will reconnect automatically. No change needed to this file. The reconnect event flows through the `connect` event handler, which is already registered in `useSocketEvents.js:31-33` (`dispatch(setPlayerId(socket.id))`). The lobby reconnect handling described above must be added in addition to this.

### Stale / Expired Room Messaging

If the 10-minute grace period expires, the server emits `game:closed { reason: "host_timeout" }`. The client's `onGameClosed` handler (`useSocketEvents.js:98-101`) calls `dispatch(resetGame())` and `navigate("/")`. This is adequate for Phase 1. The `reason` field is currently ignored — per-reason display is Phase 2.

---

## 7. Risks and Edge Cases

### Host Refreshes Page in Lobby

Host refreshes → Redux cleared → `hostToken` null in Redux. `NameEntryScreen.jsx` mounts, reads token from `localStorage` (with Phase 1 changes). Host re-enters name; reconnect path at `gameHandlers.js:146-168` handles it. Timer cancelled. Lobby resumes.

### Mobile Share Sheet Backgrounds App

iOS Safari share sheet triggers `visibilitychange` and may freeze the socket. The socket reconnects within seconds on most networks. With the 10-minute grace period, this scenario is fully covered.

### Lobby Reconnect — Ghost Host

If the host reconnects via Socket.IO (new `socket.id`) while on the lobby screen and does NOT navigate to the join screen or re-emit `game:join`, `game:start` silently fails at `gameHandlers.js:217`:
```
if (game.hostId !== socket.id) return;
```
No error is emitted to the host. This is a silent failure. The lobby reconnect handling described in §6 must be implemented to prevent this.

### Duplicate Reconnect Attempts

If `game:join` is emitted twice (double tap, StrictMode double-mount), the second emission is idempotent. `getPlayerByNickname` returns the same player, `playerId` is updated again, `clearExpiryTimer` is called again. No harmful side effect. Guard with the `submitting` flag already in `NameEntryScreen`.

### Wrong Client Tries to Reclaim Host

Guard is already in place at `gameHandlers.js:149-153`:
```
if (wasHost && !hasValidHostToken) {
  return socket.emit("join:error", {
    message: "Host reconnection requires a valid host token.",
  });
}
```
No change needed here.

### Host Joins After Expiry

Timer fires → `deleteGame` → `getGame(gameId)` returns `null`. Host emits `game:join` → `gameHandlers.js:37-39` returns `join:error: "Game not found."`. Host must create a new game.

### Timer Stacking on Multiple Disconnects

Host disconnects (timer A starts) → reconnects (timer A cancelled) → disconnects again (timer B starts). `clearExpiryTimer` (`gameStore.js:132-138`) nulls the reference after clearing, preventing double-fire. This cycle is safe and can repeat indefinitely.

### Nickname Squatting While Host Is Offline

The reconnect path looks up players by nickname (`gameHandlers.js:147`). If another player joins with the host's exact nickname while the host is in the grace period, `getPlayerByNickname` returns the new (connected) player. The host's reconnect is blocked with "Nickname already taken" (or reaches the connected-player early-return at line 148: `if (existing && !existing.connected)` is false). This is a rare edge case — document it in Open Questions §10.

### Orphaned Rooms (Existing Bug)

If the host creates a room but no one ever emits `game:join`, the room has no expiry timer and sits in memory indefinitely. `WAITING_EXPIRY_MS` and `HOST_RECONNECT_MS` timers are only set on `game:join` or host disconnect (which requires a player entry). Rooms that are never joined have no cleanup at all. This is a pre-existing bug, out of scope for Phase 1, addressed in Phase 3.

### `game:leave` vs Socket Disconnect

`game:leave` handled at `gameHandlers.js:298-352`. The host block at lines 316-329 calls `deleteGame` immediately. This is intentional and must not change — the grace period applies only to unintentional socket-level disconnects.

---

## 8. Security Notes

### Host Token Strength

`randomUUID().replace(/-/g, "")` — 32-char hex, 128 bits of entropy. Sufficient. No change needed.

### Token Transmission

Returned in HTTPS POST response body. Stored in Redux and (with the fix) `localStorage`. `localStorage` is same-origin only. Not passed as a cookie — no CSRF exposure. Do not add to URL.

### Token Not Exposed to Other Players

`sanitizePlayers` at `gameHandlers.js:754-761` maps only `{ playerId, nickname, score, connected }`. The `hostToken` field lives on the game object, not on player objects. It is never included in any broadcast payload.

### Constant-Time Comparison

`hostToken === game.hostToken` is a plain `===` check. Not constant-time, theoretically timing-attackable. In practice, 128-bit tokens over a network make this a non-risk for this application. Flag as future hardening if requirements change.

### Token Validity Lifetime

The token is valid for the lifetime of the game (multiple reconnects are expected). Single-use token rotation would add complexity without meaningful security benefit for this use case.

### `localStorage` Cleanup

Remove `fsd:hostToken:<gameId>` from `localStorage` when:
- `game:closed` fires on the client
- `game:end` fires on the client
- A new game is created (overwrite or remove previous keys)

---

## 9. Phased Rollout

### Phase 1 — Minimal Production Fix

**Goal:** Stop room deletion on host disconnect. Enable shared-link-open scenario. Enable host reconnect.

**Server changes:**
1. `server/socket/index.js` — In the `disconnect` handler, for `waiting + isHost`: replace `io.to(gameId).emit("game:closed") + deleteGame()` with:
   - `game.hostDisconnectedAt = Date.now()`
   - `io.to(gameId).emit("host:offline", { reason: "disconnected" })`
   - `setExpiryTimer(gameId, HOST_RECONNECT_MS, () => { io.to(gameId).emit("game:closed", { reason: "host_timeout" }); deleteGame(gameId); })`
   - Define `const HOST_RECONNECT_MS = 10 * 60 * 1000` at the top of the file alongside the existing `WAITING_EXPIRY_MS = 30 * 60 * 1000`.
2. `server/store/gameStore.js` — Add `hostDisconnectedAt: null` to the game object in `createGame`.
3. `server/socket/handlers/gameHandlers.js` — In the waiting-state reconnect path (lines 155-168), after updating `game.hostId`:
   - Add `game.hostDisconnectedAt = null`
   - Add `io.to(gameId).emit("host:reconnected", { players: sanitizePlayers(game.players) })`

**Client changes:**
4. `client/src/screens/HomeScreen.jsx` — Write `hostToken` to `localStorage` on game creation success.
5. `client/src/screens/NameEntryScreen.jsx` — On mount, recover `hostToken` from `localStorage` if Redux is missing it.
6. `client/src/screens/LobbyScreen.jsx` — Handle socket `connect` event; on reconnect, navigate to join screen or re-emit `game:join` with stored nickname and token.
7. `client/src/hooks/useSocketEvents.js` — Add handlers for `host:offline` and `host:reconnected`.
8. `client/src/store/gameSlice.js` — Add `hostOffline: false` field and `setHostOffline` reducer.

**Outcome:** The shared-link-open production bug is fixed. Host can reconnect after brief disconnect. The LobbyScreen no longer silently fails after a socket reconnect.

### Phase 2 — Hardening and UX Polish

1. Verify `localStorage` behavior across iOS Safari (private mode), Android Chrome, and desktop.
2. Add `localStorage` cleanup on `game:closed`, `game:end`, and new game creation.
3. Update `onGameClosed` in `useSocketEvents.js` to accept `reason` payload and display contextual messages (`host_timeout` vs `host_left` vs `host_ended`).
4. Consider exposing `hostOnline: boolean` in `GET /api/games/:gameId` response so the name entry screen can warn joiners before they enter.
5. Review the edge case where the host's nickname is taken by another player during the grace period (see Open Questions §10.3).

### Phase 3 — Cleanup and Test Coverage

1. Fix orphaned-room bug: start a short expiry timer immediately on `POST /api/games` so rooms that are never joined are eventually cleaned up.
2. Add Jest tests for the `disconnect` handler (mock `io`): assert `host:offline` is emitted, `deleteGame` is NOT called, timer is set.
3. Add Jest tests for the `gameHandlers.js` waiting reconnect path: assert `hostDisconnectedAt` is reset, `host:reconnected` is emitted, `clearExpiryTimer` is called.
4. Add Vitest tests for `localStorage` token persistence in `HomeScreen` and `NameEntryScreen`.
5. Replace the fragile `getAllGames()` pattern in `socket/index.js:63-67` (uses `require` inside a function body) with a proper top-level import.
6. Audit `game:leave` to confirm voluntary leave still results in immediate deletion with no grace period.

---

## 10. Open Questions

1. **Should LobbyScreen auto-rejoin or prompt?** On socket reconnect in the lobby, should the client silently re-emit `game:join` using Redux state (nickname + token), or navigate to the join screen and prompt the user? Silent re-join is better UX for the host; navigation is simpler to implement for all players.

2. **Should `host:offline` include a `timeoutAt` timestamp?** Enables a countdown ("Host has 8m 32s to reconnect"). Useful UX; not required for Phase 1.

3. **Nickname squatting during grace period.** If another player joins using the host's nickname while the host is offline, the host cannot reclaim their slot. Should the server reject same-nickname joins while `hostDisconnectedAt` is set? Probably yes — define this policy before implementation.

4. **Is 10 minutes the right grace period?** Typical mobile backgrounding during a share is < 2 minutes. 10 is generous. Could be made configurable via env var (`HOST_RECONNECT_MS` or similar alongside `QUESTION_TIME_LIMIT`).

5. **Should the room survive in-progress host disconnect?** Currently only when `game.playState !== "paused"` (`socket/index.js:44-46`). Separate concern, out of scope for this fix. Same pattern could be applied in a future phase.

6. **`onGameClosed` reason field.** Currently `function onGameClosed()` takes no arguments. Phase 2 should update it to accept the payload so the UI can say "The host's session expired" specifically for `reason: "host_timeout"`.

7. **Incognito / private mode.** `localStorage` is unavailable or sandboxed in some private browsing modes. Hosts in incognito mode who refresh will lose their token permanently. Document this as a known limitation — the workaround is to create a new game.
