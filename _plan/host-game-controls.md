# Host Game Controls (Pause, Resume, End, Restart, Room Persistence)

---

## 1. Feature Summary

This feature gives the host runtime control over the game across its entire lifecycle. It covers five related capabilities:

1. **Pause** — freeze the active question timer and disable player input mid-round
2. **Resume** — restore the question timer from where it was frozen
3. **End Early** — terminate the current round at any point and send players to results
4. **Post-Game Room Persistence** — when a round ends, keep the room alive with the player roster intact instead of immediately tearing it down
5. **Restart** — start a new round in the same room, resetting only round-specific state
6. **Post-Game Player Additions** — allow new players to join an ended room and be included in the next round

Currently the server tears down the game on natural end and sets a 15-minute expiry. Players cannot rejoin a completed game for another round. The host has no path to pause, intervene, or replay without recreating a new room and re-sharing a new join code.

This revision treats "ended" as a **post-game room state** — a live room that has completed a round and is waiting for the next host action — rather than as a terminal teardown state. The room identity, host, and player roster persist until the host explicitly closes it or inactivity expiry fires.

---

## 2. Goals and Non-Goals

### Goals

- Host can pause, resume, and end the game early during an active round
- When a round ends (naturally or via host action), the room and player roster persist
- Host can restart a new round in the same room from the post-game screen
- New players can join an ended room and be included in the next round
- Completed round results are preserved as an immutable snapshot; post-game joins do not alter them
- Joining is explicitly blocked while a round is in progress
- All controls are host-only with server-side authorization

### Non-Goals

- Host reassignment (transferring host role mid-session)
- Pause during the 3-second post-question transition window (v1 deferral — transition timer is currently anonymous)
- Persistent game state across server restarts (in-memory only; unchanged constraint)
- Per-player kick/ban
- Mid-game joins of any kind
- Multiple simultaneous active rooms per host
- Any changes to the REST API

---

## 3. Current Architecture Assumptions

The following is derived from the actual codebase:

- **Server**: Node/Express/Socket.IO. All game state is in-memory (`server/store/gameStore.js`) in a `Map<gameId, Game>`. No database.
- **Game object fields today**: `gameId`, `hostId`, `status` (`"waiting" | "in-progress" | "ended"`), `players[]`, `session` (`{ questions, current, totalQuestions }`), `currentQuestion`, `questionAnswered`, `questionSubmissions` (Set), `expiryTimer`, `questionTimer`
- **Timers**: `questionTimer` stored on game object. The 3-second post-question transition `setTimeout` is **anonymous and not stored** — this is a required prerequisite change.
- **Socket handlers**: `gameHandlers.js` (join, start, disconnect), `questionHandlers.js` (answer submit)
- **Client**: React/Vite, Redux (`gameSlice`), Socket.IO singleton, `useSocketEvents` hook for all event subscriptions
- **Redux state today**: `gameId`, `playerId`, `nickname`, `isHost`, `status` (`"idle" | "waiting" | "in-progress" | "ended"`), `players[]`, `currentQuestion`, `lastQuestionResult`, `hasAnswered`
- **Screens**: HomeScreen, NameEntryScreen, LobbyScreen, GameScreen, ResultsScreen
- **Join validation today**: blocks join if `status === "in-progress"` with "Game already in progress" error. **This will be relaxed for `status === "ended"` only.**
- **Expiry behavior today**: 30-min expiry in "waiting", 15-min expiry after "ended" — both call `deleteGame()`

---

## 4. Proposed Product Behavior

### When the Host Can Act

| Action | Allowed When | Not Allowed When |
|---|---|---|
| Pause | `status === "in-progress"` AND `playState === "running"` AND `questionAnswered === false` | Paused, ended, waiting, transition window |
| Resume | `status === "in-progress"` AND `playState === "paused"` | Running, ended, waiting |
| End Early | `status === "in-progress"` (paused or running) | Ended, waiting |
| Cancel Room | `status === "waiting"` | In-progress, ended |
| Restart | `status === "ended"` | In-progress, waiting |
| Close Room | `status === "ended"` | In-progress, waiting |

### When Players Can Join

| Status | Can Join? | Notes |
|---|---|---|
| `waiting` | Yes | Existing behavior |
| `in-progress` | **No** | Blocked — returns `join:error` |
| `ended` | Yes | Joins for next round; does not affect completed results |

### What Happens When a Round Ends

Whether a round ends naturally (all questions answered) or early (host action):

1. Server sets `status = "ended"`, broadcasts `game:end` with `endReason`
2. Room remains alive — the game object is **not deleted**
3. A `lastRoundResults` snapshot is saved on the game object (scores, winnerId, winnerNickname, endReason) — this snapshot is immutable
4. Player roster is retained; player scores are **not reset yet** (reset happens on restart)
5. A 15-minute room expiry timer is set; this timer is **canceled if the host restarts**
6. All clients navigate to ResultsScreen, which doubles as the post-game room screen

### What the Post-Game Room State Looks Like

- All players see the completed round's results
- Host sees post-game controls: "Restart Round", "Invite Player" (shows join link), "Close Room"
- Non-host players see: results + "Waiting for host to start next round…"
- New players who join the ended room also land on ResultsScreen/post-game view with results visible and a "Waiting for host" message

### What Restart Does

- Resets all round-specific state (scores, questions, current index, answers, timers, paused state, endReason)
- Keeps room identity (gameId), host, and player roster
- Broadcasts `game:restarted` with the reset player list (all scores 0)
- All clients navigate to LobbyScreen
- Host can then start the new round normally via the existing `game:start` flow

### End From Lobby vs End From In-Progress

| Triggered From | Server Behavior | Client Behavior |
|---|---|---|
| Lobby (`waiting`) | Broadcast `game:closed`, delete game immediately | All clients → home |
| In-progress | Broadcast `game:end` with `endReason: "host_ended"`, preserve room, set 15-min expiry | All clients → ResultsScreen |

---

## 5. UX Flow by Role

### Host — During Active Round (GameScreen)

- Control bar visible only to host
- **Running**: "Pause" and "End Game" buttons
- **Paused**: "Resume" and "End Game" buttons
- "End Game" requires confirmation (modal or `confirm()`)
- "Pause" is disabled (grayed out) during the 3-second transition window (when `questionAnswered === true`)

### Host — During Paused State (GameScreen)

- "Game Paused" overlay visible across the room
- Host sees "Resume" button to continue
- Host sees "End Game" button to terminate the round
- CountdownTimer frozen at remaining time

### Host — Post-Game (ResultsScreen)

- Sees completed round results (from `lastRoundResults` snapshot)
- Sees current player roster including any players who joined post-game
- Control bar shows:
  - **"Restart Round"** — resets round state, returns everyone to lobby
  - **"Invite Player"** — shows/toggles the join link (same as LobbyScreen ShareLink component)
  - **"Close Room"** — ends the room entirely, sends everyone home (confirmation required)

### Players — During Paused State (GameScreen)

- "Game Paused" overlay visible
- Answer buttons disabled and grayed out
- CountdownTimer frozen
- No controls; waiting for host

### Players — Post-Game State (ResultsScreen)

- Sees completed round results
- If host has restarted: navigated to LobbyScreen automatically
- Message: "Waiting for host to start next round…"
- No controls

### New Player Joining an Ended Room (NameEntryScreen → ResultsScreen)

1. Player visits the join link; game exists and `status === "ended"`
2. NameEntryScreen shows the game normally; player enters nickname and submits
3. Server validates: game exists, status is "ended", nickname is available
4. Player is added to roster with `score: 0`
5. Server broadcasts `players:updated` to all in-room players (so they see the new player appear in the roster)
6. Server emits `join:success` + `game:end` (with `lastRoundResults` snapshot) to the new player's socket
7. New player navigates to ResultsScreen; sees completed results + "Waiting for host" message
8. New player is included in the next round if host restarts

---

## 6. State Model Changes

### Conceptual Separation: Room State vs Round State

Although the codebase stores everything on one in-memory game object, it is important to treat these fields as logically distinct. Round state resets on restart; room state does not.

#### Room State (persists across rounds)

| Field | Type | Notes |
|---|---|---|
| `gameId` | `string` | Permanent room identity |
| `hostId` | `string \| null` | socket.id of current host |
| `players` | `Player[]` | Roster — present across rounds; scores reset per round |
| `status` | `"waiting" \| "in-progress" \| "ended"` | Overall room+round lifecycle |
| `expiryTimer` | `Timeout \| null` | Room-level expiry (30 min waiting, 15 min ended) |

#### Round State (resets on restart)

| Field | Type | Default | Notes |
|---|---|---|---|
| `session` | `object \| null` | `null` | `{ questions, current, totalQuestions }` |
| `currentQuestion` | `object \| null` | `null` | Sanitized question sent to clients |
| `questionAnswered` | `boolean` | `false` | True during transition window |
| `questionSubmissions` | `Set` | `new Set()` | socket.ids who submitted this question |
| `questionTimer` | `Timeout \| null` | `null` | Active question timeout |
| `transitionTimer` | `Timeout \| null` | `null` | 3-second post-question delay (**new; must be stored**) |
| `questionStartedAt` | `number \| null` | `null` | `Date.now()` at question emit; used for pause calc (**new**) |
| `playState` | `"running" \| "paused"` | `"running"` | Runtime control flag (**new**) |
| `remainingTimeMs` | `number \| null` | `null` | Ms left when paused (**new; canonical unit: milliseconds**) |
| `endReason` | `"completed" \| "host_ended" \| null` | `null` | Why this round ended (**new**) |
| `lastRoundResults` | `object \| null` | `null` | Immutable snapshot of final results (**new**) |

#### `lastRoundResults` Shape

```
{
  scores: Player[],       // snapshot of player scores at round end
  winnerId: string | null,
  winnerNickname: string | null,
  endReason: "completed" | "host_ended"
}
```

This object is written once when the round ends and is **never mutated** by subsequent player joins. It is used as the authoritative source for the ResultsScreen and is emitted to reconnecting/late-joining players via the `game:end` payload.

#### Player Object (no change to shape)

```
{
  playerId: string,
  nickname: string,
  score: number,       // reset to 0 on restart
  connected: boolean
}
```

#### What Resets on Restart

| Field | Action |
|---|---|
| All players `score` | Reset to `0` |
| `status` | `"waiting"` |
| `playState` | `"running"` |
| `session` | `null` |
| `currentQuestion` | `null` |
| `questionAnswered` | `false` |
| `questionSubmissions` | `new Set()` |
| `questionTimer` | Cleared and `null` |
| `transitionTimer` | Cleared and `null` |
| `questionStartedAt` | `null` |
| `remainingTimeMs` | `null` |
| `endReason` | `null` |
| `lastRoundResults` | `null` |
| `expiryTimer` | Canceled; replaced with 30-min waiting expiry |

#### What Persists on Restart

| Field | Action |
|---|---|
| `gameId` | Unchanged |
| `hostId` | Unchanged |
| `players[]` (roster) | Retained; only scores are reset |

### Redux Client State Changes

Add to `gameSlice` initial state:

| Field | Type | Default | Notes |
|---|---|---|---|
| `playState` | `"running" \| "paused"` | `"running"` | Mirror of server `playState` (**new**) |
| `endReason` | `"completed" \| "host_ended" \| null` | `null` | From `game:end` payload (**new**) |
| `lastRoundResults` | `object \| null` | `null` | Snapshot of results for ResultsScreen (**new**) |

Add reducers:

- `setPlayState(state, action)` — sets `playState`
- `setEndReason(state, action)` — sets `endReason`
- `setLastRoundResults(state, action)` — sets `lastRoundResults` snapshot
- `resetRound(state)` — resets all round fields to initial values; keeps `gameId`, `playerId`, `nickname`, `isHost`; sets `status = "waiting"`

The existing `resetGame()` action resets everything including room identity — retain this for navigating home.

---

## 7. Socket Event Contract

### Client → Server Events

| Event | Payload | Valid When | Who Can Send |
|---|---|---|---|
| `game:pause` | `{ gameId }` | `status === "in-progress"`, `playState === "running"`, `questionAnswered === false` | Host only |
| `game:resume` | `{ gameId }` | `status === "in-progress"`, `playState === "paused"` | Host only |
| `game:end-early` | `{ gameId }` | `status === "in-progress"` | Host only |
| `game:restart` | `{ gameId }` | `status === "ended"` | Host only |
| `game:close-room` | `{ gameId }` | `status === "ended"` | Host only |

Note: **End from lobby** remains routed through the existing `game:end-early` event. The server branches on `status`:
- `status === "waiting"` → broadcasts `game:closed`, deletes game (existing behavior, same as host disconnect in waiting)
- `status === "in-progress"` → broadcasts `game:end`, preserves room

### Server → Client Events

#### New Events

| Event | Payload | Broadcast To | Triggered By |
|---|---|---|---|
| `game:paused` | `{ remainingTimeMs: number }` | Room | `game:pause` |
| `game:resumed` | `{ remainingTimeMs: number }` | Room | `game:resume` |
| `game:restarted` | `{ players: Player[] }` | Room | `game:restart` |
| `action:error` | `{ message: string }` | Sender socket only | Any invalid host action |

#### Modified Events

| Event | New/Changed Field | Notes |
|---|---|---|
| `game:end` | `+ endReason: "completed" \| "host_ended"` | Additive; existing clients unaffected |
| `game:end` | `+ scores` already present; payload now also serves as `lastRoundResults` | No structural change |
| `players:updated` | Now also broadcast during `status === "ended"` for post-game joins | Existing event, expanded usage |
| `game:closed` | `+ reason: "host_ended" \| "host_disconnected"` | Additive for observability |

#### Event That Is Reused (No Change Needed)

| Event | Reuse Context |
|---|---|
| `game:closed` | End from lobby + room close from post-game + host disconnect in waiting |
| `lobby:updated` | After restart, when status returns to "waiting" and players join normally |
| `join:error` | Still fires if player attempts to join during in-progress |

### Reconnect Sync Events (per-socket, not broadcast)

When a player reconnects (via `game:join` with matching nickname), the server emits the following depending on game state:

| State | Server Emits to Reconnecting Socket |
|---|---|
| `status === "waiting"` | `lobby:updated` (existing behavior) |
| `status === "in-progress"`, `playState === "running"` | `question:start` with current question |
| `status === "in-progress"`, `playState === "paused"` | `question:start` then `game:paused { remainingTimeMs }` |
| `status === "ended"` | `game:end` with `lastRoundResults` + `endReason` |

### New Player Join Sync (post-game, first-time join in ended state)

When a **new** player (not a reconnect) joins during `status === "ended"`:

1. Server adds player to roster
2. Emits `join:success` (implicit — client navigates on `game:end` receipt)
3. Emits `game:end` payload (from `lastRoundResults`) to the new player's socket
4. Broadcasts `players:updated` to all players in the room

---

## 8. Server-Side Behavioral Spec

### Authorization Guard (all new handlers)

```
const game = getGame(gameId);
if (!game) return socket.emit("action:error", { message: "Game not found." });
if (socket.id !== game.hostId) return socket.emit("action:error", { message: "Only the host can do that." });
```

### `game:pause` Handler

**Guard**: `status === "in-progress"`, `playState === "running"`, `questionAnswered === false`
If paused already: silently ignore.
If `questionAnswered === true` (transition window): emit `action:error { message: "Cannot pause between questions." }`.

**Logic**:
1. Calculate `remainingTimeMs = (game.questionStartedAt + questionTimeLimit * 1000) - Date.now()`; clamp to `Math.max(0, value)`
2. `clearTimeout(game.questionTimer)`; `game.questionTimer = null`
3. `game.remainingTimeMs = remainingTimeMs`
4. `game.playState = "paused"`
5. Broadcast `game:paused { remainingTimeMs }` to room

### `game:resume` Handler

**Guard**: `status === "in-progress"`, `playState === "paused"`
If running already: silently ignore.

**Logic**:
1. `game.playState = "running"`
2. `game.questionTimer = setTimeout(() => endQuestion(io, gameId, null, null), game.remainingTimeMs)`
3. Update `game.questionStartedAt = Date.now() - (questionTimeLimit * 1000 - game.remainingTimeMs)` — so remaining time calculation stays correct if a second pause occurs
4. Broadcast `game:resumed { remainingTimeMs: game.remainingTimeMs }` to room
5. `game.remainingTimeMs = null`

### `game:end-early` Handler

**Guard**: `status === "in-progress"` OR `status === "waiting"`
If `status === "ended"`: silently ignore.
Non-host: `action:error`.

**Branch A: `status === "waiting"`** (Cancel from lobby)

1. Broadcast `game:closed { reason: "host_ended" }` to room
2. `deleteGame(gameId)` — clears expiry timer and removes from map

**Branch B: `status === "in-progress"`**

1. `clearTimeout(game.questionTimer)`; `clearTimeout(game.transitionTimer)`; both set to `null`
2. Compute winner from current `game.players` scores (same logic as natural end: highest score; `null` if tie)
3. Set `game.status = "ended"`, `game.playState = "running"`, `game.remainingTimeMs = null`, `game.endReason = "host_ended"`
4. Build and store `game.lastRoundResults = { scores: [...game.players], winnerId, winnerNickname, endReason: "host_ended" }` — **snapshot is immutable from this point**
5. Broadcast `game:end { scores, winnerId, winnerNickname, endReason: "host_ended" }` to room
6. `setExpiryTimer(gameId, ENDED_EXPIRY_MS, () => deleteGame(gameId))` — room expiry, not round teardown

### `game:restart` Handler

**Guard**: `status === "ended"`
Non-host: `action:error`.
If `status !== "ended"`: emit `action:error { message: "Can only restart after a round has ended." }`.

**Logic**:
1. `clearTimeout(game.expiryTimer)` — cancel the post-game room expiry
2. Reset round state on the game object:
   - `game.session = null`
   - `game.currentQuestion = null`
   - `game.questionAnswered = false`
   - `game.questionSubmissions = new Set()`
   - `game.questionTimer = null`
   - `game.transitionTimer = null`
   - `game.questionStartedAt = null`
   - `game.playState = "running"`
   - `game.remainingTimeMs = null`
   - `game.endReason = null`
   - `game.lastRoundResults = null`
3. Reset all player scores: `game.players.forEach(p => p.score = 0)`
4. `game.status = "waiting"`
5. `setExpiryTimer(gameId, WAITING_EXPIRY_MS, () => deleteGame(gameId))` — fresh 30-min expiry
6. Broadcast `game:restarted { players: sanitizedPlayers(game.players) }` to room

### `game:close-room` Handler

**Guard**: `status === "ended"`
Non-host: `action:error`.

**Logic**:
1. Broadcast `game:closed { reason: "host_ended" }` to room
2. `deleteGame(gameId)`

### `answer:submit` Handler — Pause Guard

Add at the top of the existing validation chain, before duplicate/question-number checks:

```
if (game.playState === "paused") {
  socket.emit("answer:rejected", { reason: "Game is paused." });
  return;
}
```

### `game:join` Handler — Join Rules

Revise the existing join validation to update the `status === "ended"` branch:

**Current behavior**: Allows reconnects only; rejects new players with "Game already in progress."
**New behavior**:

```
if (status === "ended") {
  const existingPlayer = getPlayerByNickname(gameId, nickname);
  if (existingPlayer && !existingPlayer.connected) {
    // Reconnect path: update playerId, set connected, emit lastRoundResults
    markConnected(gameId, existingPlayer.playerId → socket.id);
    socket.emit("game:end", { ...game.lastRoundResults });
    io.to(gameId).emit("players:updated", sanitizedPlayers);
  } else if (!existingPlayer) {
    // New player joining post-game
    addPlayer(gameId, { playerId: socket.id, nickname, score: 0, connected: true });
    socket.emit("game:end", { ...game.lastRoundResults }); // so client navigates to ResultsScreen
    io.to(gameId).emit("players:updated", sanitizedPlayers);
  } else {
    socket.emit("join:error", { message: "Nickname already taken." });
  }
}
```

The `lastRoundResults` snapshot remains unchanged; the new player's presence in `game.players` will only be reflected in the next round after restart.

### `disconnect` Handler — New Cases

| State | Host Disconnects | Non-Host Disconnects |
|---|---|---|
| `waiting` | `game:closed` + `deleteGame()` (existing) | `lobby:updated` + reset expiry (existing) |
| `in-progress` | Game continues; mark disconnected; `players:updated` (existing). **No change.** | Mark disconnected; `players:updated` (existing) |
| `in-progress`, `playState === "paused"` | Broadcast `game:closed { reason: "host_disconnected" }`; `deleteGame()` | Mark disconnected; `players:updated` |
| `ended` | Mark disconnected; `players:updated`. Room persists. | Mark disconnected; `players:updated` |

### `emitQuestion` — New Fields

When a question starts, additionally set:

```
game.questionStartedAt = Date.now();
game.playState = "running";         // Ensure clean state on each question
game.remainingTimeMs = null;
```

Store the transition timer on the game object:

```
game.transitionTimer = setTimeout(() => {
  game.transitionTimer = null;
  // ... existing: next question or game end
}, 3000);
```

### Natural Game End — `lastRoundResults` Snapshot

In the existing `endQuestion` path, when it is the final question (before calling `game:end`):

```
game.lastRoundResults = {
  scores: game.players.map(p => ({ ...p })),  // shallow copy
  winnerId,
  winnerNickname,
  endReason: "completed"
};
game.endReason = "completed";
```

---

## 9. Client-Side Behavioral Spec

### Redux — New State Fields and Reducers

```js
// gameSlice initial state additions
playState: "running",        // "running" | "paused"
endReason: null,             // "completed" | "host_ended" | null
lastRoundResults: null,      // snapshot object or null
```

New reducers:

| Reducer | Effect |
|---|---|
| `setPlayState(payload)` | Sets `state.playState` |
| `setEndReason(payload)` | Sets `state.endReason` |
| `setLastRoundResults(payload)` | Sets `state.lastRoundResults` |
| `resetRound()` | Resets all round fields; keeps `gameId`, `playerId`, `nickname`, `isHost`; sets `status = "waiting"`, `playState = "running"`, clears question/result/paused/endReason/lastRoundResults state |

`resetGame()` remains for full teardown (navigating home).

### useSocketEvents — New and Changed Listeners

| Event | Redux Dispatches | Navigation |
|---|---|---|
| `game:paused` | `setPlayState("paused")` | none |
| `game:resumed` | `setPlayState("running")`, `setCurrentQuestion({ ...currentQuestion, timeLeft: payload.remainingTimeMs / 1000 })` | none |
| `game:restarted` | `resetRound()`, `setPlayers(payload.players)` | → LobbyScreen (`/game/:gameId/lobby`) |
| `game:closed` | `resetGame()` | → HomeScreen (`/`) |

Modified listeners:

| Event | Change |
|---|---|
| `game:end` | Also dispatch `setEndReason(payload.endReason ?? "completed")` and `setLastRoundResults(payload)` |
| `players:updated` | Already dispatches `updateScores(players)` — this now also fires during `ended` state for post-game joins; no listener change needed |

### CountdownTimer — Resume Sync

`CountdownTimer` currently seeds from `timeLimit` prop at mount using a local `setInterval`. After `game:resumed`, the Redux `currentQuestion.timeLeft` is updated to `remainingTimeMs / 1000`. The component must re-initialize its interval when `timeLeft` changes from outside (use a `key` derived from `timeLeft` at question start, or watch `timeLeft` in a `useEffect` and restart the interval). The exact implementation is a component-level concern; the spec requirement is that the displayed timer matches `remainingTimeMs` received from the server within one tick after resume.

### Screens — Changes Required

#### GameScreen

- Render `<HostControls />` component conditionally: `{isHost && <HostControls />}`
- When `playState === "paused"`: render `<PausedOverlay />` above the question content; disable all answer buttons
- `PausedOverlay` is dismissed when `playState` returns to `"running"` in Redux

**`HostControls` component** (new, host-only, rendered in GameScreen):

| `playState` | Buttons Shown |
|---|---|
| `"running"` | "Pause" (disabled if `questionAnswered === true`), "End Game" |
| `"paused"` | "Resume", "End Game" |

- "End Game" always shows confirmation before emitting `game:end-early`
- "Pause" is visually disabled (but not hidden) during the transition window

#### LobbyScreen

- Replace or supplement existing "Cancel Game" behavior:
  - Host sees "Cancel Game" button
  - Emits `game:end-early` (server handles `status === "waiting"` → `game:closed`)
  - Confirmation required

#### ResultsScreen (becomes Post-Game Room Screen)

ResultsScreen reads from `lastRoundResults` (Redux), not from `players` directly, for rendering the score table. This keeps the results display immutable after new players join.

The `players` array in Redux (updated by `players:updated`) is used only for the **current roster display** (e.g., "Who's in the room") in the post-game UI.

**Host post-game controls** (new `HostPostGameControls` component, host-only):

| Button | Action | Condition |
|---|---|---|
| "Restart Round" | Emit `game:restart { gameId }` | Always shown when `status === "ended"` |
| "Invite Player" | Toggle join link visibility (reuse ShareLink component) | Always shown |
| "Close Room" | Emit `game:close-room { gameId }` with confirmation | Always shown |

**Non-host post-game view**:

- Sees results
- Sees current player roster (from `players` in Redux, updates in real-time as others join)
- Message: "Waiting for host to start next round…"

**New player who joins post-game**:

- Receives `game:end` event on their socket → navigates to ResultsScreen
- Sees completed results (from `lastRoundResults`) with a note that they weren't in this round
- Sees "Waiting for host…" message

#### NameEntryScreen

- Already handles `status === "ended"` reconnect path
- Add handling: if server sends `game:end` after a new post-game join, navigate to ResultsScreen (this event already triggers ResultsScreen navigation in `useSocketEvents`; no change needed if routing is correct)

---

## 10. Edge Cases and Failure Modes

| Scenario | Expected Behavior |
|---|---|
| Non-host sends pause/resume/end/restart/close | `action:error` to sender; no state change |
| Duplicate `game:pause` | Already `playState === "paused"` → silently ignored |
| Duplicate `game:resume` | Already `playState === "running"` → silently ignored |
| Duplicate `game:restart` | `status` is back to `"waiting"` → guard fires: `action:error` |
| Duplicate `game:end-early` after game is already ended | `status === "ended"` → silently ignored |
| Duplicate `game:close-room` | Game already deleted → `getGame` returns null → `action:error` |
| Restart when `status !== "ended"` | `action:error { message: "Can only restart after a round has ended." }` |
| End early from ended state | Silently ignored (idempotent guard) |
| Player joins during `in-progress` | Existing `join:error { message: "Game already in progress." }` — no change |
| Player joins during `ended` with taken nickname | `join:error { message: "Nickname already taken." }` |
| Player joins during `ended` with new nickname | Added to roster; receives `game:end` with `lastRoundResults`; all others receive `players:updated` |
| Post-game join must not alter results | `lastRoundResults` is a shallow copy set at round end and never reassigned; new player is added to `game.players` only |
| Host disconnects while paused | `game:closed { reason: "host_disconnected" }` broadcast to room; `deleteGame()` |
| Host disconnects while `status === "ended"` | Game persists (room expiry continues); host's player entry marked disconnected; `players:updated` broadcast |
| Host reconnects while `status === "ended"` | Existing reconnect path: `game:end` emitted to host's socket with `lastRoundResults`; `hostId` is re-assigned to new socket.id (handle in `game:join` reconnect branch by checking nickname against existing host) |
| Player reconnects while paused | Receives `question:start` then `game:paused { remainingTimeMs }` in order; cannot submit |
| Player reconnects while `status === "ended"` | Receives `game:end` with `lastRoundResults`; navigates to ResultsScreen |
| Pause requested with < 100ms remaining | `remainingTimeMs = Math.max(0, value)`. If 0, question resolves immediately on resume (setTimeout fires on next tick). Acceptable for v1. |
| End requested at exact same moment timer expires | `endQuestion()` sets `game.questionAnswered = true` before broadcasting. If `game:end-early` arrives and `questionAnswered === true`: clear `transitionTimer`, build `lastRoundResults` from current scores (which already include the timer-expired question), broadcast `game:end` with `endReason: "host_ended"`. No crash; latest committed scores win. |
| Restart requested immediately after end | No issue; `status === "ended"` guard passes immediately |
| Room expiry fires while host is idle on ResultsScreen | `deleteGame()` fires; all connected sockets in the room lose their game. Server could emit `game:closed { reason: "expired" }` before deleting (currently silent). Recommended: broadcast `game:closed` from inside the expiry callback |
| Server restart (process crash) | All in-memory state lost; all connected clients will receive a socket disconnect; they end up on HomeScreen. No mitigation; in-memory limitation. |
| Two rapid `game:restart` events | First sets `status = "waiting"`, second hits guard and gets `action:error`. Idempotent. |

---

## 11. Rollout Plan

Implement in this order. Each step is independently deployable and non-breaking.

### Step 1 — Prerequisite: Store Transition Timer and `questionStartedAt`

**Scope**: `server/socket/handlers/gameHandlers.js` only
Store the 3-second transition `setTimeout` as `game.transitionTimer`. Store `game.questionStartedAt = Date.now()` in `emitQuestion()`. No behavior change; this unblocks all subsequent steps.

**Why first**: Everything else depends on being able to clear the transition timer and calculate remaining time accurately. Zero risk.

### Step 2 — Host End Early (In-Progress)

**Scope**: New `game:end-early` socket handler; `game:end` payload extension; `lastRoundResults` snapshot; ResultsScreen `endReason` display; keep room alive after end
**Client**: `useSocketEvents` update for `endReason`; ResultsScreen subtitle
**Why second**: Simplest new path. Reuses existing `game:end` broadcast. Delivers immediate host value. Also establishes the room-persistence model needed for restart.

### Step 3 — Post-Game Room Persistence and Post-Game Joins

**Scope**: Update `game:join` handler for `status === "ended"`; `players:updated` during ended state; ResultsScreen becomes post-game room screen; host post-game controls (invite link, close room)
**Why third**: Depends on Step 2 (room must persist to accept joins). No timer changes. Establishes the post-game room model before adding restart complexity.

### Step 4 — Restart

**Scope**: `game:restart` handler; `game:restarted` broadcast; `resetRound()` Redux reducer; client navigation on `game:restarted`
**Why fourth**: Depends on Step 3 (post-game room must exist). Round reset logic is straightforward once room persistence is in place.

### Step 5 — Pause and Resume

**Scope**: `game:pause` / `game:resume` handlers; `game:paused` / `game:resumed` broadcasts; `playState` on game object and Redux; PausedOverlay; CountdownTimer resume sync; answer rejection during pause
**Why fifth**: More complex (timer math, client sync, overlay state). Safely deferred until the lifecycle model is stable. Building pause on top of a stable end/restart model reduces risk.

### Step 6 (Future) — Pause During Transition Window

Requires a different UX decision (should pause queue for next question or block the transition timer). Defer until v1 is validated in production.

### Risk Assessment

| Step | Risk | Mitigation |
|---|---|---|
| 1 | Very low — additive only | Review that anonymous setTimeout is fully replaced; no behavior changes |
| 2 | Low — new event, additive payload field | Ensure `lastRoundResults` snapshot is built before broadcasting `game:end` |
| 3 | Medium — join handler changes could affect reconnect logic | Careful branching: reconnect vs new join vs mid-game join must all be explicitly handled |
| 4 | Low — depends on stable Step 3 | Verify expiry timer is correctly canceled; test that scores genuinely reset |
| 5 | Medium — timer math on pause/resume + client sync | Test edge cases: pause near expiry, rapid pause/resume, CountdownTimer re-init |

---

## 12. Acceptance Criteria

### Room Persistence

- [ ] After natural round end: game object remains in memory; `status === "ended"`; `lastRoundResults` snapshot is set
- [ ] After host-ended round: same as above
- [ ] 15-minute expiry timer is set on end; room is deleted after 15 minutes of inactivity
- [ ] `game:closed` is broadcast from within the expiry callback before `deleteGame()`

### Restart

- [ ] `game:restart` from host when `status === "ended"` → round state reset, player scores zeroed, `status = "waiting"`, `game:restarted` broadcast
- [ ] `game:restarted` received by all clients → all navigate to LobbyScreen; scores show 0; `status = "waiting"` in Redux
- [ ] `game:restart` when `status !== "ended"` → `action:error`; no state change
- [ ] `game:restart` from non-host → `action:error`
- [ ] Room expiry timer is canceled on restart; new 30-minute waiting expiry is set
- [ ] `gameId` is unchanged after restart
- [ ] Player roster is unchanged after restart (same nicknames, scores reset)
- [ ] After restart, host can start the next round via existing `game:start` flow

### Post-Game Player Additions

- [ ] New player joins when `status === "ended"` → added to roster; receives `game:end` with `lastRoundResults`; navigates to ResultsScreen
- [ ] All existing players receive `players:updated` when new player joins post-game
- [ ] `lastRoundResults` snapshot is not modified by post-game joins
- [ ] ResultsScreen score table reads from `lastRoundResults`, not from live `players` array
- [ ] New player's score is shown as 0 in the roster sidebar, not in the completed results table
- [ ] After restart, new player is included in the next round with score 0

### Join Blocking During In-Progress

- [ ] Player attempts `game:join` when `status === "in-progress"` → `join:error { message: "Game already in progress." }`; player is not added to roster

### End Early (In-Progress)

- [ ] `game:end-early` from host during in-progress → `questionTimer` and `transitionTimer` cleared; `status = "ended"`; `game:end` broadcast with `endReason: "host_ended"`; room persists
- [ ] `game:end-early` when `status === "ended"` → silently ignored
- [ ] ResultsScreen displays "Game ended early by host" when `endReason === "host_ended"`

### End / Cancel from Lobby

- [ ] `game:end-early` from host during `status === "waiting"` → `game:closed` broadcast; game deleted; all clients navigate home

### Close Room (Post-Game)

- [ ] `game:close-room` from host when `status === "ended"` → `game:closed` broadcast; game deleted; all clients navigate home
- [ ] `game:close-room` from non-host → `action:error`

### Pause / Resume

- [ ] `game:pause` from host during running question → `questionTimer` cleared, `playState = "paused"`, `remainingTimeMs` stored, `game:paused` broadcast
- [ ] `game:pause` during transition window (`questionAnswered === true`) → `action:error`
- [ ] `game:pause` when already paused → silently ignored
- [ ] `game:pause` from non-host → `action:error`
- [ ] `game:resume` from host while paused → `questionTimer` restarted from `remainingTimeMs`, `playState = "running"`, `game:resumed` broadcast
- [ ] `game:resume` when already running → silently ignored
- [ ] `game:resume` from non-host → `action:error`
- [ ] Answer submitted while paused → `answer:rejected { reason: "Game is paused." }`
- [ ] Timer after resume counts down from `remainingTimeMs`, not from original `timeLimit`
- [ ] If pause occurs and `remainingTimeMs === 0`, resume triggers immediate question timeout

### Client UI

- [ ] Host sees Pause/End in GameScreen (running) and Resume/End (paused)
- [ ] "Pause" button is visually disabled during transition window
- [ ] Host sees Restart/Invite/Close Room controls on ResultsScreen
- [ ] Non-host players do not see any host controls
- [ ] Paused overlay shown on GameScreen for all clients when `playState === "paused"`; dismissed on resume
- [ ] Answer buttons disabled while paused; re-enabled on resume
- [ ] CountdownTimer freezes while paused; resumes from `remainingTimeMs` on resume

### Reconnect Behavior

- [ ] Player reconnects while paused → receives `question:start` then `game:paused { remainingTimeMs }`; lands on GameScreen with paused overlay and frozen timer
- [ ] Player reconnects while `status === "ended"` → receives `game:end` with `lastRoundResults`; navigates to ResultsScreen
- [ ] Host reconnects while `status === "ended"` → `hostId` updated; host sees post-game controls

### Host Disconnect

- [ ] Host disconnects while `playState === "paused"` → `game:closed` broadcast; game deleted; players navigate home
- [ ] Host disconnects while `status === "ended"` → room persists; host entry marked disconnected; `players:updated` broadcast

### Socket Reliability

- [ ] Rapid pause → resume → pause produces consistent state with no orphaned timers
- [ ] `game:end-early` at same instant as natural question timer expiry does not double-broadcast `game:end`
- [ ] Duplicate `game:restart` events are idempotent (second ignored after status is "waiting")

---

## 13. Open Questions / Decisions

- **Host reconnect and `hostId` reassignment**: When the host reconnects in `ended` state, should `hostId` be reassigned to the new `socket.id`? Currently the spec assumes yes (via nickname match in the `game:join` reconnect branch). This needs an explicit implementation decision since `hostId` is stored as a socket.id and socket.ids change on reconnect.

- **Pause overlay scope**: Should the "Game Paused" overlay cover only the question/answer area, or the full viewport including the score header? Product decision; no server impact.

- **Post-game join visibility**: Should a player who joins during `ended` state see the completed round's scores in the results table, or only see a "You weren't in this round" message? Spec currently recommends showing the completed results (from `lastRoundResults`) to all, including late joiners.

- **Expiry notification**: Should the server broadcast `game:closed { reason: "expired" }` before deleting on expiry, so clients can show a message? Currently specified as recommended but not mandated.

- **Pause from transition window (v2)**: When implemented, should pause during transition defer to the next question start (i.e., pause takes effect before the next `emitQuestion()` fires) or cancel the next question entirely? Decision deferred.

---

## 14. Likely File Impact Map

| File | Change Type | What Changes |
|---|---|---|
| `server/store/gameStore.js` | Additive | New fields on game object: `playState`, `remainingTimeMs`, `questionStartedAt`, `transitionTimer`, `endReason`, `lastRoundResults`. New `clearTransitionTimer()` helper optional. |
| `server/socket/handlers/gameHandlers.js` | Additive + Modify | Store `transitionTimer` and `questionStartedAt` in `emitQuestion()`. Update `endQuestion()` to write `lastRoundResults`. New handlers: `game:restart`, `game:close-room`. Modify `game:end-early` to branch on status and preserve room. Modify `game:join` for `status === "ended"` branch. Update disconnect handler for paused+host case. |
| `server/socket/handlers/questionHandlers.js` | Modify | Add `playState === "paused"` guard at top of `answer:submit`. |
| `server/socket/index.js` | Additive | Register new handlers: `game:pause`, `game:resume`, `game:restart`, `game:close-room`. |
| `client/src/store/gameSlice.js` | Additive | New state fields: `playState`, `endReason`, `lastRoundResults`. New reducers: `setPlayState`, `setEndReason`, `setLastRoundResults`, `resetRound`. |
| `client/src/hooks/useSocketEvents.js` | Additive | New listeners: `game:paused`, `game:resumed`, `game:restarted`. Modified: `game:end` dispatches `setEndReason` and `setLastRoundResults`. |
| `client/src/screens/GameScreen.jsx` | Modify | Add `<HostControls />`, `<PausedOverlay />`, disable answer buttons when `playState === "paused"`. |
| `client/src/screens/ResultsScreen.jsx` | Modify | Read results from `lastRoundResults` (not `players`). Add `<HostPostGameControls />`. Show `endReason` subtitle. Show live roster sidebar. Non-host "waiting" message. |
| `client/src/screens/LobbyScreen.jsx` | Modify | Host cancel/end-game button emitting `game:end-early`. |
| `client/src/components/CountdownTimer.jsx` | Modify | Accept controlled `timeLeft` reset; re-initialize interval on resume. |
| `client/src/components/HostControls.jsx` | New | Pause/Resume/End buttons for GameScreen; emits `game:pause`, `game:resume`, `game:end-early`. |
| `client/src/components/HostPostGameControls.jsx` | New | Restart/Invite/Close Room buttons for ResultsScreen; emits `game:restart`, `game:close-room`; toggles ShareLink. |
| `client/src/components/PausedOverlay.jsx` | New | Full-area "Game Paused" overlay rendered when `playState === "paused"`. |

---

## Assumptions

- The anonymous 3-second transition `setTimeout` in `endQuestion()` will be stored as `game.transitionTimer` as an initial prerequisite (Step 1).
- `questionStartedAt` is stored in milliseconds (`Date.now()`) and `remainingTimeMs` is also in milliseconds throughout server logic. Clients receive `remainingTimeMs` and convert to seconds for display only.
- Winner calculation on early end uses the existing highest-score logic from natural end.
- The `game:join` reconnect branch currently identifies returning players by nickname + `!connected`. This same mechanism is used for host reconnect in `ended` state; `hostId` is updated to the new `socket.id`.
- `lastRoundResults` is a plain object with a shallow-copied `scores` array; deep clone is not required since player objects are not nested.
- Joining during `ended` state does not require a host approval step in v1; the join link alone is sufficient authorization.
- `resetGame()` (full teardown for HomeScreen navigation) is preserved unchanged; `resetRound()` is the new partial reset for restart.
- The existing `game:closed` client listener (`resetGame()` + navigate to `/`) handles both Cancel-from-lobby and Close-Room-from-post-game without changes.
