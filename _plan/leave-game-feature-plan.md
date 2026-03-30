# Leave Game Feature Plan

## Summary

Add a minimal voluntary leave flow so players can exit a game intentionally. This complements the existing socket disconnect behavior by making intentional exit explicit, keeping server player lists accurate, and providing a consistent client-side return-to-home path.

## Goal

Implement a safe leave feature with small backend and frontend changes:

- add `game:leave` socket handling on the server
- remove explicit players on voluntary leave
- broadcast lobby/player updates to remaining clients
- add leave controls in Lobby, Game, and Results screens
- reset local game state and return a leaving player to `/`

## Constraints

- keep the fix minimal and backward compatible
- do not introduce host handoff in this release
- preserve accidental disconnect semantics separately from voluntary leave
- avoid new backend persistence or broad architectural changes

## Non-goals

- host transfer/secondary host election
- full reconnect recovery redesign
- large UI redesigns or new screen flows
- introducing new global route state

## Implementation steps

1. Server store helper
   - Add `removePlayer(gameId, playerId)` in `server/store/gameStore.js`
   - Ensure it removes the player cleanly and returns the updated game object

2. Server socket handler
   - Add `socket.on("game:leave", ...)` in `server/socket/handlers/gameHandlers.js`
   - Validate payload and membership
   - If the leaving player is not the host:
     - remove the player
     - if waiting: emit `lobby:updated`
     - otherwise: emit `players:updated`
   - If the leaving player is host:
     - if waiting or in-progress: emit `game:closed` and delete the game
     - if ended: remove the player and emit `players:updated` if needed

3. Client leave controls
   - add a `Leave Game` button for non-hosts in `LobbyScreen.jsx`
   - add a `Leave Game` button in `GameScreen.jsx`
   - ensure `ResultsScreen.jsx` continues to support a leave/home action

4. Client behavior
   - on leave click, optionally confirm if the game is in progress
   - emit `socket.emit("game:leave", { gameId })`
   - dispatch `resetGame()`
   - navigate to `/`

5. Tests
   - add `removePlayer()` coverage in `server/store/gameStore.test.js`
   - add server socket tests for voluntary leave in waiting, in-progress, and host leave cases
   - add frontend tests for leave buttons and navigation behavior

## Validation criteria

- non-host players can leave from the lobby and active game
- remaining players receive updates without stale entries
- host leaving waiting closes the room for everyone
- voluntary leave does not use accidental disconnect logic
- leaving client resets local state and returns home

## Execution order

1. `server/store/gameStore.js` — add `removePlayer`
2. `server/socket/handlers/gameHandlers.js` — add `game:leave`
3. `server/store/gameStore.test.js` — unit tests
4. `server/socket/handlers/gameHandlers.test.js` — socket integration tests
5. `client/src/screens/LobbyScreen.jsx` — leave button
6. `client/src/screens/GameScreen.jsx` — leave button
7. `client/src/screens/ResultsScreen.jsx` — ensure button behavior
8. `client/src/store/gameSlice.js` — verify `resetGame()` behavior if needed
9. `client` tests for navigation and leave interactions

## Deliverables

- `server/store/gameStore.js`
- `server/socket/handlers/gameHandlers.js`
- `server/store/gameStore.test.js`
- `server/socket/handlers/gameHandlers.test.js`
- `client/src/screens/LobbyScreen.jsx`
- `client/src/screens/GameScreen.jsx`
- `client/src/screens/ResultsScreen.jsx`
- optional `client` tests for leave interactions
