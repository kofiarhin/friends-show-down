# Leave Game - Feature Specification

## Goal

Allow players to voluntarily leave an active game session in a controlled way, instead of relying on socket disconnect semantics. This should support:

- non-host players leaving safely from lobby, in-progress, or results screens
- hosts leaving in waiting state by closing the room
- consistent server-side player removal and lobby/player list updates
- client state reset and navigation back to home

## Why this matters

The current implementation only handles disappearance through network disconnects, which conflates accidental loss of connectivity with intentional exit. A dedicated leave flow improves UX, prevents stale `connected: false` player entries, and makes room lifecycle behavior explicit.

## Scope

### In scope

- new socket event: `game:leave`
- backend handling for voluntary leave
- client buttons/actions for leaving in `LobbyScreen`, `GameScreen`, and `ResultsScreen`
- broadcast updates to remaining players
- reset local game state and navigate home for the leaving client
- server tests for leave behavior
- frontend tests for leave interaction and navigation

### Out of scope

- host handoff to another player
- new persistent storage
- large UX redesigns beyond minimal leave controls

## User experience

### Lobby

- non-host players see a `Leave Game` button
- confirmation prompt appears before leaving
- after leaving, the player is returned to `/`
- remaining players receive updated lobby state

### In-progress game

- non-host players can leave mid-game via a `Leave Game` button
- confirm before exiting while the game is active
- other players receive an updated player list

### Results

- `Leave Game` button continues to send the user home
- optional server-side removal keeps the post-game player list cleaner for spectators

### Host behavior

- host leaving from waiting state closes the room for everyone
- host leaving from in-progress can either end the game or remain unsupported in this first pass; build the minimal safe behavior of closing the game session

## API contract

### Client → Server

`socket.emit("game:leave", { gameId })`

- `gameId` is required
- the event is authenticated by socket identity only

### Server → Client

Non-host leave in waiting state:

- `io.to(gameId).emit("lobby:updated", { players, genre })`

Non-host leave in-progress or ended:

- `io.to(gameId).emit("players:updated", { players })`

Host leave while waiting:

- `io.to(gameId).emit("game:closed", { reason: "host_left" })`

Host leave while in-progress:

- `io.to(gameId).emit("game:closed", { reason: "host_left" })`
  - if the current code cannot safely transfer host ownership

Leaving client:

- optional local navigation to `/`
- no additional server event required beyond the leave acknowledgment/update

## Server implementation details

### `server/store/gameStore.js`

Add a helper:

- `removePlayer(gameId, playerId)`
  - remove a player from `game.players`
  - preserve existing timers
  - return the updated game or null

Keep existing helpers for reconnect behavior.

### `server/socket/handlers/gameHandlers.js`

Register a handler:

- `socket.on("game:leave", (payload) => { ... })`

Validation:

- payload exists and includes `gameId`
- the socket belongs to a player in the game

Behavior:

- if the socket is not part of the game, ignore or emit `action:error`
- if the leaving player is the host:
  - if `game.status === "waiting"`:
    - emit `game:closed` to the room
    - `deleteGame(gameId)`
  - if `game.status === "in-progress"`:
    - emit `game:closed` to the room
    - `deleteGame(gameId)`
  - if `game.status === "ended"`:
    - remove player and emit `players:updated` if needed
- if the leaving player is not the host:
  - call `removePlayer(gameId, socket.id)`
  - if waiting: emit `lobby:updated`
  - if in-progress or ended: emit `players:updated`

Server should not treat this as a disconnect event; voluntary leave is explicit.

### `server/socket/index.js`

Continue using `disconnect` for accidental disconnects. No field changes required, but ensure leave and disconnect do not both emit duplicated room closure messages.

## Client implementation details

### `client/src/screens/LobbyScreen.jsx`

Add a new button:

- text: `Leave Game`
- shown for non-hosts in the lobby
- confirmation modal before leaving
- on confirm:
  - `socket.emit("game:leave", { gameId })`
  - dispatch `resetGame()`
  - `navigate("/")`

### `client/src/screens/GameScreen.jsx`

Add a leave action in the gameplay UI:

- button label: `Leave Game`
- confirm before exiting if `status === "in-progress"`
- same behavior as lobby leave

### `client/src/screens/ResultsScreen.jsx`

Ensure the existing leave control uses the same leave event if the server-side cleanup is needed.

### `client/src/hooks/useSocketEvents.js`

No additional event listeners are required unless the leaving client needs a leave acknowledgment. The current `game:closed` listener may be reused by host-close behavior.

## State requirements

No new Redux state is needed beyond existing game slice fields.

Client leave behavior should use `resetGame()` to clear:

- `gameId`
- `playerId`
- `nickname`
- `status`
- `players`
- `currentQuestion`
- `lastQuestionResult`
- `chatMessages`
- `startError`

## Acceptance criteria

### 1. Non-host can leave from lobby

- Given a player in a lobby,
- when they click `Leave Game`,
- then the client navigates to `/`,
- and remaining players receive a `lobby:updated` event with the removed player omitted.

### 2. Non-host can leave mid-game

- Given a player in a live game,
- when they click `Leave Game`,
- then the client navigates to `/`,
- and remaining players receive `players:updated`.

### 3. Host leaving waiting room closes the game

- Given the host in a waiting lobby,
- when they click `Leave Game`,
- then all connected players receive `game:closed` and return to `/`.

### 4. Host leaving in-progress closes the game

- Given the host in an in-progress game,
- when they click `Leave Game`,
- then the room ends cleanly and all players receive `game:closed`.

### 5. Voluntary leave does not create stale disconnected players

- Given a player who left intentionally,
- the player no longer appears in `players` lists after the event is processed.

## Test coverage

### Server tests

- `server/store/gameStore.test.js`
  - `removePlayer()` removes the correct player and returns updated game
  - leaving a missing game returns `null`
- `server/socket/handlers/gameHandlers.test.js`
  - non-host leave in waiting emits `lobby:updated`
  - non-host leave in-progress emits `players:updated`
  - host leave in waiting emits `game:closed`
  - host leave in-progress emits `game:closed`
  - leaving with invalid payload emits `action:error`

### Client tests

- `client/src/screens/LobbyScreen.test.jsx`
  - non-host leave emits `game:leave`
  - navigation happens after leave
- `client/src/screens/GameScreen.test.jsx`
  - leave button is visible and triggers side effects
- `client/src/screens/ResultsScreen.test.jsx`
  - existing leave path remains correct

## Implementation notes

- Keep the feature minimal: voluntary leave is explicit, accidental disconnects remain separate.
- Avoid host handoff in this version.
- Use the same server room closure event for host leaves as existing host disconnect handling if possible.
- Only remove players on explicit leave; do not remove them on accidental disconnect until reconnect timeout.
