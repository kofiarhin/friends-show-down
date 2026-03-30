# Game Flow Audit

## Summary

This audit reviews the current client/server game flow for consistency, recovery, and potential failure modes. The main issues are:

- route state is not guarded, so stale URLs can show invalid screens
- join flow validation on the client contradicts server reconnection support
- voluntary leave and disconnect handling introduce edge cases around room membership and stale game state

## Findings

### 1. No route guard for invalid session routes

Affected code:
- `client/src/screens/NameEntryScreen.jsx`
- `client/src/screens/GameScreen.jsx`
- `client/src/screens/LobbyScreen.jsx`
- `client/src/screens/ResultsScreen.jsx`

Issues:
- `GameScreen.jsx` renders a waiting message when `!currentQuestion`, even if the game is `ended` or `waiting`.
- There is no centralized route resolution. The app relies entirely on socket events to move players between lobby/play/results.
- If a page is refreshed on `/play` or a stale URL is entered directly, the user can be stuck on an invalid screen until the next socket event.

Risk:
- High: stale URLs can break the player experience and leave users on an incorrect page.

### 2. Join screen and backend validation are inconsistent

Affected code:
- `client/src/screens/NameEntryScreen.jsx`
- `server/routes/games.js`

Issues:
- `GET /api/games/:gameId` returns `409` for `in-progress` or `ended` games.
- Server socket logic in `gameHandlers.js` supports reconnecting an existing disconnected player into an in-progress game.
- A refreshed or new browser session on the join route will be blocked before socket reconnection logic can execute.

Risk:
- Medium/high: reconnect support is effectively broken in the current frontend flow.

### 3. NameEntryScreen fails to subscribe to in-progress / ended reconnect events

Affected code:
- `client/src/screens/NameEntryScreen.jsx`

Issues:
- `NameEntryScreen` listens only for `join:error` and `lobby:updated`.
- It does not listen for `question:start`, `game:end`, or `game:closed`.
- If a disconnected player rejoins to an in-progress or ended game, the page will not navigate appropriately.

Risk:
- Medium: players may reconnect to the wrong screen or remain stuck after successful server-side reconnection.

### 4. Voluntary leave behavior has inconsistent room cleanup

Affected code:
- `server/socket/handlers/gameHandlers.js`
- `client/src/screens/LobbyScreen.jsx`
- `client/src/screens/GameScreen.jsx`
- `client/src/screens/ResultsScreen.jsx`

Issues:
- `game:leave` for non-hosts in ended/waiting states removes the player and emits updates, but only the waiting case calls `socket.leave(gameId)`.
- `game:leave` for a host leaving an ended session removes the player but does not call `socket.leave(gameId)`. The socket may remain in the room.
- `game:leave` host in waiting/in-progress closes the game, but the host remains in the room until the room is deleted.

Risk:
- Medium: room membership may become inconsistent, especially for players leaving ended sessions.

### 5. Host-based session lifecycle is brittle

Affected code:
- `server/socket/index.js`
- `server/socket/handlers/gameHandlers.js`

Issues:
- Host disconnect while game is `in-progress` does not close the room unless `playState === "paused"`.
- This means a host can disappear and the game may continue without a valid host or recovery path.
- `game:leave` for host in ended state leaves a stale `hostId` and may keep the game alive until expiry.

Risk:
- Medium: orphaned games and unexpected state if the host leaves or disconnects.

### 6. Results screen lacks an explicit host leave/exit control

Affected code:
- `client/src/screens/ResultsScreen.jsx`

Issue:
- Non-hosts have a `Leave Game` button, but hosts are shown only host post-game controls.
- Hosts have no explicit leave action after an ended game in the current UI.

Risk:
- Low/UX: host may be forced to use browser controls rather than a UI action.

### 7. `useSocketEvents` may over-dispatch state updates

Affected code:
- `client/src/hooks/useSocketEvents.js`

Potential issues:
- `onGameEnd` dispatches both `setLastRoundResults(payload)` and `setQuestionResult(payload)`, which uses the emitted end payload and may produce an inconsistent `lastQuestionResult` shape.
- `onRoundPhase` also dispatches `setQuestionResult` if `payload.lastResult` exists, which may update question state while `game:end` is also pending.

Risk:
- Low/behavioral: could lead to transient UI hiccups or mismatched state shapes.

## Recommendations

1. Add a centralized client-side route guard to resolve invalid session URLs.
2. Align `GET /api/games/:gameId` with socket reconnection semantics if reconnecting in-progress games is required.
3. Add `useSocketEvents` or equivalent event listeners to `NameEntryScreen` for `question:start`, `game:end`, and `game:closed`.
4. Clean up room membership in `game:leave` for all cases, especially host leaving ended games.
5. Consider a deterministic fallback when the host disconnects from an in-progress game.
6. Add a host leave action to `ResultsScreen` or document why it is intentionally absent.
7. Add regression tests for stale route access, reconnect-on-join, and voluntary leave cleanup.

## Audit output

- stale-route / missing guard: high
- join/reconnect mismatch: medium/high
- NameEntrySocket subscription gap: medium
- leave room cleanup: medium
- host disconnect/orphaned games: medium
- host UX on results: low
- state update overlap in socket events: low

## Suggested todo file

- [ ] Add client route guard for `/game/:id/*` pages
- [ ] Add `useSocketEvents` support to `NameEntryScreen`
- [ ] Align backend join validation with reconnect support
- [ ] Fix `game:leave` host-ended socket room cleanup
- [ ] Add host leave action on ResultsScreen
- [ ] Add tests for stale route access and reconnect flow
