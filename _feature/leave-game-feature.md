# Leave Game Feature

## Goal
Add a proper "Leave Game" feature so individual players can exit a session intentionally instead of relying on socket disconnect semantics.

## Current behavior
- Clients only leave by closing the socket/losing connection.
- The server marks disconnected players with `connected: false` and keeps them in the player list.
- The host disconnect in waiting state closes the game immediately.
- There is no explicit `game:leave` event or player removal flow.

## Why this feature is needed
- Improves UX by giving players a clear escape path.
- Prevents stale `connected: false` players from remaining in lobby lists forever.
- Lets the server handle voluntary leave differently from accidental disconnect.
- Enables a clean client-side state reset on exit.

## Proposed design

### New socket event
- `game:leave` payload: `{ gameId }`
- Server validates `gameId` and current `socket.id` belongs to a player in that game.

### Server semantics
- Non-host leaves (`game.status: waiting | in-progress | ended`):
  - Remove player from `game.players`.
  - If waiting: emit `lobby:updated` with remaining players.
  - If in-progress or ended: emit `players:updated`.
  - If the leaving player is currently in the socket room, call `socket.leave(gameId)`.

- Host leaves:
  - If waiting: close the game and emit `game:closed` with `{ reason: "host_left" }`.
  - If in-progress: either end the game early or transfer host ownership.
    - Minimal safe behavior: end the game and close the room, because the current implementation is not built for host handoff.
  - If ended: remove host as a player and emit `players:updated` if anyone remains.

### Store changes
- Add a new helper in `server/store/gameStore.js`:
  - `removePlayer(gameId, playerId)`
- Keep the existing `markDisconnected`/`markConnected` helpers for reconnect semantics, but use `removePlayer` for voluntary leave.

### Client changes
- Add a visible "Leave Game" or "Exit" action in:
  - `client/src/screens/LobbyScreen.jsx`
  - `client/src/screens/GameScreen.jsx`
  - `client/src/screens/ResultsScreen.jsx`
- On click:
  - emit `socket.emit("game:leave", { gameId });`
  - dispatch `resetGame()`
  - navigate back to `/`
- Optionally add a confirmation prompt for leaving mid-game.

### Event flow suggestion
- Client: `socket.emit("game:leave", { gameId })`
- Server: validate / remove player / broadcast updates
- Other clients:
  - `lobby:updated` updates the waiting room
  - `players:updated` updates scores and attendance in active games
- Leaving client:
  - reset local UI state and go home

## Implementation steps

1. `server/store/gameStore.js`
   - Add `removePlayer(gameId, playerId)`.
   - Preserve existing timers and cleanup behavior.

2. `server/socket/handlers/gameHandlers.js`
   - Register `socket.on("game:leave", ...)`.
   - Validate payload and game membership.
   - Handle host vs non-host separately.
   - Broadcast correct state update or close event.

3. `server/socket/index.js`
   - Keep current `disconnect` logic for accidental network issues.
   - Ensure voluntary leave does not accidentally trigger duplicate close messages.
   - Optionally call `socket.removeAllListeners()` after `leave` if you want to clean up immediately.

4. `client/src/screens/LobbyScreen.jsx`
   - Add a leave button for non-host players.
   - Use `socket.emit("game:leave", { gameId })`, then `resetGame()` and `navigate("/")`.

5. `client/src/screens/GameScreen.jsx`
   - Add a leave button in the game UI.
   - Prompt for confirmation when leaving mid-game.

6. `client/src/screens/ResultsScreen.jsx`
   - Replace the current `Leave Game` button behavior with an explicit leave event or keep it as a client-side exit if server-side removal is no longer needed.

7. `client/src/store/gameSlice.js`
   - Ensure `resetGame()` clears `players`, `currentQuestion`, `status`, `nickname`, etc.
   - No new state needed unless you want to track `leftGame` status.

8. Tests
   - `server/store/gameStore.test.js`
     - add coverage for `removePlayer()`.
   - `server/socket/handlers/gameHandlers.test.js`
     - verify non-host leave updates `lobby:updated` / `players:updated`.
     - verify host leave in waiting closes the room.
     - verify host leave in-progress chooses the intended behavior.
   - `client/src/screens/*` tests
     - verify leave button emits `game:leave` and navigates home.

## Risks and tradeoffs
- A full host transfer flow is more complex than a simple leave feature.
- Minimal safe behavior is to close games when the host leaves during waiting or in-progress.
- If the feature removes players from the list, rejoining with the same nickname becomes possible only after the player leaves completely.

## Recommended files to edit
- `server/store/gameStore.js`
- `server/socket/handlers/gameHandlers.js`
- `server/socket/index.js`
- `client/src/screens/LobbyScreen.jsx`
- `client/src/screens/GameScreen.jsx`
- `client/src/screens/ResultsScreen.jsx`
- `client/src/store/gameSlice.js`

## Notes
- The codebase already has a `Leave Game` button on `ResultsScreen` that currently only navigates home.
- A dedicated leave event is the correct way to distinguish intentional exit from socket disconnect.
