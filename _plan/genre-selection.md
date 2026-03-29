# Genre Selection for Game Rooms

## Summary

When a host creates a game room they are currently given no choice over what questions will be asked — the server shuffles and uses the full question pool. This feature adds a required genre/category selection step to the create-game flow. The chosen genre is stored as part of the room's persistent configuration. When the host starts the game the server sources the question session exclusively from that genre's question bank. Gameplay logic, scoring, timers, and the socket-driven round model are unchanged.

---

## Goals and Non-Goals

**Goals**
- Host must select a genre when creating a room.
- Genre is stored on the room object and persists across restarts.
- Question session at game start is generated from the selected genre's bank.
- All players see the genre in the lobby and on the results screen.
- NameEntry (join) screen exposes the genre so players know what they are joining.
- `Mixed` is a first-class genre that draws randomly from all categories.

**Non-Goals**
- Host cannot change genre after room creation in v1.
- No per-player genre preference or voting.
- No external trivia API integration in v1.
- No database persistence of rooms, questions, or genres.
- No genre-based filtering during active gameplay.
- No mid-round genre changes of any kind.
- No genre-level statistics or analytics.

---

## Current Architecture Assumptions

Grounded in the actual codebase at time of spec.

| Area | Current state |
|---|---|
| `server/data/questions.json` | Single flat array, no genre field, ~N questions |
| `server/store/gameStore.js` `createGame()` | Takes `(gameId, hostId)`, no genre, no `config` field |
| `server/routes/games.js` `POST /api/games` | No request body consumed; returns `{ gameId, gameUrl }` |
| `server/routes/games.js` `GET /api/games/:gameId` | Returns `{ gameId, status, playerCount }` — no genre |
| `server/socket/handlers/gameHandlers.js` `game:start` | Does `shuffleArray(questions)` directly on the full imported array |
| `server/socket/handlers/gameHandlers.js` `game:restart` | Resets session fields; no reference to genre |
| `lobby:updated` socket event | Emits `{ players }` only |
| `game:restarted` socket event | Emits `{ players }` only |
| `client/src/store/gameSlice.js` | No `genre` field |
| `client/src/screens/HomeScreen.jsx` | Fire-and-forget POST, then navigate — no body sent |
| `client/src/screens/NameEntryScreen.jsx` | Fetches game to validate it exists; does not display genre |
| `client/src/screens/LobbyScreen.jsx` | Shows players and start button; no genre display |

---

## Proposed Product Behavior

### Genre selection
- Genre is **required**. A room cannot be created without one.
- There is no pre-selected default. The host must make an active choice.
- `Mixed` is available as the first option and covers all categories.
- Genre is fixed at room creation. It **cannot be changed** once the room exists — not in waiting state, not after restart, not ever in v1.

### Genre visibility by screen

| Screen | What is shown | To whom |
|---|---|---|
| HomeScreen | Genre selector before POST | Host only |
| NameEntryScreen | Genre label below game ID | All (host + joining players) |
| LobbyScreen | Genre badge/label | All |
| GameScreen | Not shown (no change) | — |
| ResultsScreen | Genre label near round heading | All |

### When genre cannot be changed
- Once `POST /api/games` succeeds with a genre, the genre is locked for the lifetime of the room.
- Restart does not reset genre. The room config persists; only session state resets.
- There is no host UI to change genre from the lobby or post-game screen in v1.

---

## Room Config vs Round State

This distinction is critical for restart correctness.

### Persistent room config (survives restart)
These fields exist on the game object and are **never reset** by `game:restart`:

| Field | Description |
|---|---|
| `game.config.genre` | The genre the host selected at creation (`"mixed"`, `"science"`, etc.) |
| `game.gameId` | Room identifier |
| `game.hostId` | Updated on reconnect; not reset |
| `game.players` | Roster persists; scores reset to 0 on restart |

### Round / session state (reset on restart)
These fields are already reset by `game:restart` and remain so:

| Field | Resets to |
|---|---|
| `game.session` | `{ questions: [], current: 0, totalQuestions: 0 }` |
| `game.currentQuestion` | `null` |
| `game.questionAnswered` | `false` |
| `game.questionSubmissions` | `new Set()` |
| `game.questionTimer` | `null` |
| `game.transitionTimer` | `null` |
| `game.questionStartedAt` | `null` |
| `game.playState` | `"running"` |
| `game.remainingTimeMs` | `null` |
| `game.endReason` | `null` |
| `game.lastRoundResults` | `null` |
| `player.score` | `0` for all players |
| `game.status` | `"waiting"` |

**Rule**: anything inside `game.config` is room-level and survives restart. Anything inside `game.session` or tied to an active round is session-level and resets.

---

## Question Source Strategy

### Comparison

| Strategy | Pros | Cons |
|---|---|---|
| **Local static categorized banks** | Zero infra, zero latency, zero cost, works offline, fully deterministic, version-controlled | Content must be maintained manually; no dynamic updates |
| Database-backed categories | Dynamic, updatable without deploy | Requires DB, migrations, seeding, admin tooling — huge scope increase for v1 |
| External trivia API (e.g. Open Trivia DB) | Large question pool, no manual curation | Network dependency, rate limits, API keys, inconsistent formatting, unreliable at game-start time |

**Recommendation: local static categorized banks for v1.**

The game is in-memory with no persistence layer. Adding a DB or external API dependency purely for questions introduces risk and complexity that is not justified at this stage. Local banks are trivially version-controlled, easy to extend, and make `game:start` fully synchronous and deterministic.

### File structure
Replace or supplement `server/data/questions.json` with per-genre files:

```
server/data/questions/
  mixed.json         ← curated cross-category set, or dynamically assembled
  science.json
  geography.json
  politics.json
  history.json
  sports.json
  entertainment.json
```

Each file is an array of question objects with the same schema as the current `questions.json`.

A `server/utils/questionBank.js` module loads and indexes all genre files at server startup. It exports a function `getQuestionsByGenre(genre)` that returns the array for that genre. `Mixed` can either:
- Have its own curated `mixed.json`, **or**
- Be assembled at load time by sampling N questions from each category

**Recommendation**: give `Mixed` its own `mixed.json` for v1. Sampling logic adds complexity and makes test counts unpredictable. A hand-curated mixed bank is simpler and gives editorial control over balance.

### Minimum question count
- The minimum required to run a game is the number of questions per session (currently all questions in the bank are used, shuffled).
- Define a server constant `MIN_QUESTIONS_PER_GENRE = 10`.
- Validation occurs at **server startup** (warn/throw if any active genre bank is below minimum) and again at **`game:start`** (as a safety check before session generation begins).

### Behavior if a genre has too few questions
- At `game:start`, if `getQuestionsByGenre(genre).length < MIN_QUESTIONS_PER_GENRE`, emit an error event to the host only and abort. Room status must not change. Room remains in `"waiting"` state.
- The question session is never partially populated. It is all-or-nothing.

---

## Create Game Flow

### Current flow
1. Host clicks **Create Game** on HomeScreen.
2. `POST /api/games` fires immediately with no body.
3. On success, navigate to `/game/:id/join`.

### Updated flow
1. Host lands on HomeScreen.
2. Host clicks **Create Game**.
3. A genre selector appears inline (below the button, same screen — no new route needed).
4. Host selects a genre from the list. Selection is required; the confirm button is disabled until a genre is chosen.
5. Host clicks **Confirm** (or the selector auto-confirms on selection — v1 recommendation: require explicit confirm button to avoid accidental selection on mobile).
6. `POST /api/games` fires with body `{ genre: "science" }` (lowercase slug).
7. Server validates genre is a known slug. If invalid, returns `400 { message: "Invalid genre." }`.
8. Server calls `createGame(gameId, null, genre)` — stores genre in `game.config.genre`.
9. Response: `{ gameId, gameUrl }` (unchanged shape).
10. Client dispatches `setGame({ gameId, isHost: true, genre })` and navigates to `/game/:id/join`.

### Validation rules
- Genre is required in the POST body. Missing genre → `400`.
- Genre must match a known slug from the server's allowlist. Unknown genre → `400`.
- Genre validation is server-authoritative. Client-side genre list is for UX only.

### Genre slugs (server allowlist)
```
mixed
science
geography
politics
history
sports
entertainment
```

### What gets stored on the game object
```
game.config = {
  genre: "science"   // slug, validated, immutable after creation
}
```

---

## Lobby and Waiting-State Behavior

### What the lobby shows
- Genre is displayed as a badge or label near the room heading (e.g. "Science" in the room header alongside the game ID).
- All connected players see the genre.
- The existing player list, share link, and host controls are unchanged.

### Host controls in waiting state
- **No genre change allowed in v1.** There is no UI to change genre once the room exists.
- If the host wants a different genre they must cancel the room and create a new one.
- This is deliberately simple for v1. See Open Questions for a v2 path.

### Real-time sync
- `lobby:updated` emits `{ players, genre }`. All clients update their Redux `genre` from this event on each lobby update.
- This is primarily for players who join late and miss the initial state — the genre is always included so clients are never stale.

### NameEntry screen
- `GET /api/games/:gameId` response must include `genre` (added to the existing `{ gameId, status, playerCount }` shape).
- NameEntry displays the genre below the game ID heading so joining players know what topic they are entering.
- Genre is shown even before the nickname is submitted.

---

## Start Game Behavior

### Server-side start sequence (updated `game:start` handler)
1. Validate caller is host and game is in `"waiting"` state (unchanged).
2. Validate connected player count ≥ 2 (unchanged).
3. Read `game.config.genre`.
4. Call `getQuestionsByGenre(genre)` from `questionBank.js`.
5. Validate returned array length ≥ `MIN_QUESTIONS_PER_GENRE`.
6. If validation fails:
   - Emit `start:error` to the **host socket only**: `{ message: "Not enough questions for this genre. Try a different category." }`
   - Return without mutating game state. Room stays in `"waiting"`.
7. If validation passes:
   - Shuffle the genre's question array.
   - Assign to `game.session.questions`, `game.session.totalQuestions`, `game.session.current = 0`.
   - Set `game.status = "in-progress"`.
   - Proceed to `emitQuestion(io, gameId)` as today.

### Client-side handling of `start:error`
- `useSocketEvents` listens for `start:error`.
- Dispatches an action to store the error message in Redux (new field: `startError`).
- LobbyScreen displays the error inline near the start button.
- The start button remains enabled so the host can retry or cancel.
- Error clears on next `game:start` attempt.

### Critical invariant
Game state must never be partially mutated on a failed start. The check-then-mutate sequence must be ordered: all validation first, then all mutation.

---

## Restart and Post-Game Behavior

### Restart keeps the genre
`game:restart` already resets session state. The `game.config` object is not touched. The genre survives.

`game:restarted` emits `{ players, genre }` so all clients can confirm their Redux state has the correct genre for the new round.

### Host post-game screen
- Results screen shows the genre that was used for the completed round.
- Genre comes from `lastRoundResults.genre` (add to `buildGameEnd` payload) or from Redux `game.genre` (which persists through `resetRound`).
- Recommendation: include `genre` in the `game:end` payload and in `buildGameEnd` so it is self-contained in the results object.

### Genre visibility in ended state
- `game:end` payload includes `genre`.
- Results screen displays genre badge.
- New players joining a post-game room (already supported in `game:join` ended-state branch) receive `game:end` which now includes genre, so they see the correct label.

### Host cannot change genre from results screen
- No UI for this in v1. Host can restart (same genre) or close room and create a new one.

---

## Join Behavior

### Pre-join: NameEntry screen
- `GET /api/games/:gameId` now includes `genre` in its response.
- NameEntry screen shows genre below the game ID. Joining players know the topic before committing a nickname.
- Genre is informational only at this step — players cannot influence it.

### Post-join: Lobby
- On successful `game:join`, server emits `lobby:updated` with `{ players, genre }` to the room.
- All clients in the room (including the new joiner) receive the genre and render it.

### Joining a game in progress
- Reconnecting players receive `question:start` as today. Genre is not re-emitted on reconnect — client already has it from Redux (or from `lobby:updated` before the round started).
- If Redux genre is missing on reconnect, it will be correctly populated on the next `lobby:updated` or `game:end` event. There is no scenario where a reconnecting player needs genre to play — it is display-only.

### Joining a completed (ended) room
- New player joins post-game room → server emits `game:end` to that socket. `game:end` includes `genre`. Client renders results + genre correctly.

---

## State Model Changes

### Server — game object

**Add `game.config`** as a top-level field alongside existing fields:

```
game.config = {
  genre: string   // validated slug; set at creation; never mutated
}
```

`createGame(gameId, hostId, genre)` — add `genre` as a third parameter and populate `game.config.genre`.

No other changes to the game object structure. Session state fields are unchanged.

### Server — `buildGameEnd`

Include `genre` in the returned object:
```
{
  scores,
  winnerId,
  winnerNickname,
  endReason,
  genre         // ← add this
}
```

### Redux — `gameSlice`

Add `genre` to `initialState`:
```
genre: null,    // string slug or null
```

Add `setGenre` reducer.

**`resetRound`** — genre must be **preserved**, not reset. Update `resetRound` to spread `genre: state.genre` alongside the existing preserved fields (`gameId`, `playerId`, `nickname`, `isHost`).

**`resetGame`** — returns full `initialState` including `genre: null`. This is correct — full reset on leaving/creating a new game.

### Redux — fields summary

| Field | Type | Resets on `resetRound` | Resets on `resetGame` |
|---|---|---|---|
| `genre` | `string \| null` | No (preserved) | Yes |
| All existing fields | (unchanged) | (unchanged) | Yes |

### REST API shape changes

`POST /api/games` request body:
```json
{ "genre": "science" }
```

`POST /api/games` response: unchanged `{ gameId, gameUrl }`.

`GET /api/games/:gameId` response: add `genre`:
```json
{ "gameId": "...", "status": "waiting", "playerCount": 2, "genre": "science" }
```

---

## Socket / Event Contract

### Changed events

| Event | Direction | Current payload | Updated payload |
|---|---|---|---|
| `lobby:updated` | Server → Client | `{ players }` | `{ players, genre }` |
| `game:restarted` | Server → Client | `{ players }` | `{ players, genre }` |
| `game:end` | Server → Client | `{ scores, winnerId, winnerNickname, endReason }` | + `genre` |

### New events

| Event | Direction | Payload | Purpose |
|---|---|---|---|
| `start:error` | Server → Host only | `{ message: string }` | Emitted when `game:start` fails validation (e.g. question bank too small). Host-only, not broadcast. |

### Unchanged events
All other events (`question:start`, `question:end`, `answer:submit`, `answer:rejected`, `game:closed`, `game:paused`, `game:resumed`, `join:error`, `players:updated`) are **unchanged**. Genre does not affect round mechanics.

### `game:start` — no genre in payload
The host does not resend genre on start. Server reads `game.config.genre` authoritatively. The client payload for `game:start` remains `{ gameId }`.

### Design rationale
- Genre is already on the room at creation. Resending it on start would duplicate state and create a vector for client-supplied overrides.
- Including genre in `lobby:updated` ensures every new joiner gets the genre without needing a separate fetch.
- `start:error` is host-only by design — players do not need to know about start failures.

---

## Server-Side Behavioral Spec

### `POST /api/games` handler
1. Read `genre` from `req.body`.
2. If `genre` is absent or not in the known slug allowlist → `400 { message: "Genre is required." }` or `400 { message: "Invalid genre." }` respectively.
3. Generate unique `gameId` (unchanged).
4. Call `createGame(gameId, null, genre)`.
5. Return `201 { gameId, gameUrl }` (unchanged).

### `GET /api/games/:gameId` handler
- Add `genre: game.config.genre` to the response object.

### `gameStore.createGame(gameId, hostId, genre)`
- Accept `genre` as third parameter.
- Set `game.config = { genre }` on the new game object.

### `gameHandlers.js` — `game:start`
- After host/status/player-count validation:
  1. `const genre = game.config.genre`
  2. `const pool = getQuestionsByGenre(genre)`
  3. `if (pool.length < MIN_QUESTIONS_PER_GENRE)` → `socket.emit('start:error', { message: '...' })` and return
  4. `const shuffled = shuffleArray(pool)`
  5. Assign shuffled to `game.session.*` and proceed as today

### `gameHandlers.js` — `lobby:updated` emit
- Change all `io.to(gameId).emit('lobby:updated', { players: ... })` calls to include `genre: game.config.genre`.
- This applies to every place `lobby:updated` is emitted (join, reconnect, expiry reset).

### `gameHandlers.js` — `game:restarted` emit
- Include `genre: game.config.genre` in the event payload.

### `gameHandlers.js` — `buildGameEnd`
- Include `genre: game.config.genre` in the returned object.

### `questionBank.js` (new utility)
- Load all genre JSON files at module load time.
- Export `getQuestionsByGenre(genre: string): Question[]`.
- Export `VALID_GENRES: string[]` for use in route validation.
- If a file for a registered genre is missing or below minimum length at startup, log a warning (or throw, depending on desired strictness — recommend `throw` so misconfiguration is caught at boot, not at first game start).

### Genre allowlist
Defined once in `questionBank.js` (or a shared `constants.js`). Imported by both the route handler and the socket handler to avoid duplication.

### Restart behavior
`game:restart` handler does not touch `game.config`. No change needed beyond including `genre` in the `game:restarted` payload.

---

## Client-Side Behavioral Spec

### HomeScreen

**Genre selector step**
- Clicking **Create Game** reveals an inline genre selector below the button (the button text can change to "Choose a category first" while selector is visible, or the selector can appear immediately — either works).
- Genre options are rendered as a list of selectable buttons or a styled radio group.
- Genre labels: Mixed, Science, Geography, Politics, History, Sports, Entertainment.
- A **Confirm** button (or equivalent) is disabled until a genre is selected.
- On confirm: `mutate({ genre: selectedGenre })` — the `createGame` service function sends `{ genre }` in the POST body.
- On success: dispatch `setGame({ gameId, isHost: true, genre })` and navigate (unchanged flow).
- On error: show error message as today. Genre selector remains visible for retry.
- Mutation `isPending` state disables the confirm button and shows a loading label.

**No change to the Join Game flow** — genre is not needed there.

### NameEntryScreen
- `GET /api/games/:gameId` now returns `genre`.
- Display genre as a secondary label below the Game ID (e.g. "Category: Science").
- No interaction required — informational only.
- If genre is absent from the response (e.g. older room or unexpected state), render nothing — do not crash.

### LobbyScreen
- Display genre label in the header area, alongside or below the game ID.
- Genre comes from Redux `game.genre` (populated via `lobby:updated`).
- All players (host and non-host) see the genre.
- Host has no UI to change genre (v1).

### useSocketEvents

**`lobby:updated`**
- Destructure `{ players, genre }` from payload.
- Dispatch `setPlayers(players)` (unchanged).
- Dispatch `setGenre(genre)` (new).

**`game:restarted`**
- Destructure `{ players, genre }`.
- Dispatch `resetRound()` (unchanged — `resetRound` now preserves `genre`).
- Dispatch `setGenre(genre)` after `resetRound` to ensure it is set correctly even if the preserved value somehow differs.
- Dispatch `setPlayers(players)` (unchanged).
- Navigate to lobby (unchanged).

**`game:end`**
- Destructure `{ ..., genre }`.
- Dispatch `setGenre(genre)` alongside existing dispatches.

**`start:error`** (new listener)
- Dispatch `setStartError(payload.message)`.
- New field `startError` in Redux, cleared on next `game:start` attempt.

### ResultsScreen
- Display genre as a label near the round heading (e.g. "Category: Science").
- Source from Redux `game.genre`.
- If null/absent, render nothing.

### Redux additions
- `genre: null` in `initialState`.
- `startError: null` in `initialState` (cleared on `setCurrentQuestion` and on start attempt).
- `setGenre(state, action)` reducer — sets `state.genre = action.payload`.
- `setStartError(state, action)` reducer.
- `resetRound` — preserve `genre: state.genre`.
- `resetGame` — returns full `initialState` (genre and startError both null).

---

## Edge Cases and Failure Modes

| Scenario | Expected behavior |
|---|---|
| Host submits create form without selecting genre | Confirm button is disabled; POST never fires. If genre is somehow missing in the request, server returns 400. |
| Unknown/tampered genre slug in POST body | Server returns `400 { message: "Invalid genre." }`. Client shows mutation error. |
| Selected genre bank has fewer than `MIN_QUESTIONS_PER_GENRE` questions | `game:start` emits `start:error` to host. Room stays in `"waiting"`. Host sees error message near start button. |
| Genre bank file is missing on server | `questionBank.js` throws at startup. Server does not start. This is caught in dev/CI before reaching production. |
| Host changes genre right before start | Not possible in v1 — no UI or socket event for genre change exists. Any manually crafted socket event with a genre override is ignored (server reads `game.config.genre` only). |
| Restart after a round ends | `game:restart` does not modify `game.config.genre`. Next `game:start` uses the same genre. |
| Post-game join in ended room | `game:join` (ended path) emits `game:end` which now includes `genre`. New player's client receives genre and renders it on ResultsScreen. |
| Server process restart (in-memory loss) | All rooms are lost. Clients are disconnected. Nothing specific to genre — this is the existing in-memory limitation. No new behavior needed. |
| Stale client Redux state after reconnect | `lobby:updated` is emitted on every join/reconnect and always includes `genre`. Client will receive correct genre even if Redux was stale or cleared. |
| `lobby:updated` received while game is in-progress (e.g. player reconnects) | `useSocketEvents` still dispatches `setGenre(genre)` — this is safe and idempotent since genre never changes. |
| `resetRound` accidentally clearing genre | Spec requires `genre` to be explicitly preserved in `resetRound`, matching the pattern already used for `gameId`, `playerId`, `nickname`, `isHost`. This must be tested. |
| Mixed genre pool is empty or missing | Same as any other genre: server throws at startup if `mixed.json` is absent or too small. |
| Two players on same client, different nicknames | Not a genre concern — unchanged behavior. |

---

## Rollout Plan

The order below is chosen to keep the app functional at every step. Each phase can be merged and deployed independently without breaking existing rooms or clients.

### Phase 1 — Question bank restructure (server only, no behavior change)
1. Create `server/data/questions/` directory.
2. Create per-genre JSON files. Populate each with sufficient questions (`>= MIN_QUESTIONS_PER_GENRE`).
3. `mixed.json` is its own curated file.
4. Create `server/utils/questionBank.js` that loads all genre files, validates them at startup, and exports `getQuestionsByGenre` and `VALID_GENRES`.
5. Update the existing `game:start` handler to call `getQuestionsByGenre("mixed")` as a temporary stub (preserving current behavior — Mixed questions replace the current flat list).
6. Old `questions.json` can remain until Phase 4 confirms the new bank is working.
7. **Risk**: zero user-facing change. App behaves identically. Validates the bank module works.

### Phase 2 — Room creation accepts and stores genre (server + REST)
1. Update `createGame(gameId, hostId, genre)` to accept and store `game.config.genre`.
2. Update `POST /api/games` to read, validate, and forward `genre`.
3. Update `GET /api/games/:gameId` to return `genre`.
4. Temporarily default to `"mixed"` in `createGame` if genre is absent (backwards-compat shim for the old client during transition — remove in Phase 5).
5. **Risk**: server accepts genre but client does not yet send it. Default shim ensures existing clients continue to work.

### Phase 3 — Client genre selector on HomeScreen
1. Add genre selector UI to HomeScreen.
2. Send `genre` in `POST /api/games` body.
3. Dispatch `setGenre` into Redux on room creation.
4. Add `genre` field and `setGenre` / `setStartError` to `gameSlice`.
5. Update `resetRound` to preserve `genre`.
6. **Risk**: client now sends genre; server now stores it. No gameplay impact yet. Can be tested end-to-end.

### Phase 4 — Wire genre to session generation + start:error
1. Update `game:start` handler to use `game.config.genre` when sourcing questions.
2. Add `start:error` emit on insufficient question pool.
3. Remove old `questions.json` import from `gameHandlers.js`.
4. **Risk**: first phase that affects actual gameplay. Requires Phase 1 banks to be complete and validated.

### Phase 5 — Genre visibility in lobby, join, results, restart
1. Add `genre` to `lobby:updated`, `game:restarted`, and `game:end` payloads.
2. Update `useSocketEvents` to dispatch `setGenre` from these events.
3. Display genre in LobbyScreen, NameEntryScreen, ResultsScreen.
4. Remove backwards-compat default-genre shim from Phase 2.
5. **Risk**: additive display changes only. No gameplay logic involved.

### Phase 6 (optional, v2) — Allow host to change genre while in waiting state
- New socket event `room:set-genre` (host only, waiting state only).
- Emits `lobby:updated` with new genre on success.
- Add host UI in LobbyScreen (genre selector, re-use HomeScreen component).
- Not in v1 scope.

---

## Acceptance Criteria

### Create flow
- [ ] HomeScreen shows genre selector when host initiates room creation
- [ ] Confirm button is disabled until a genre is selected
- [ ] `POST /api/games` includes `genre` in the request body
- [ ] Server rejects `POST` with no genre with `400`
- [ ] Server rejects `POST` with unknown genre slug with `400`
- [ ] On success, Redux `game.genre` is set to the selected genre
- [ ] Host is navigated to NameEntry as before

### Validation
- [ ] All genre slugs in the server allowlist have a corresponding question bank file
- [ ] Server throws at startup if any active genre bank has fewer than `MIN_QUESTIONS_PER_GENRE` questions
- [ ] `game:start` handler emits `start:error` to host if bank is too small at start time
- [ ] `start:error` does not mutate game state — room remains in `"waiting"`
- [ ] LobbyScreen displays `start:error` message to host inline

### Room storage of genre
- [ ] `game.config.genre` is set on creation and never mutated
- [ ] `game:restart` does not alter `game.config.genre`
- [ ] `GET /api/games/:gameId` response includes correct genre
- [ ] `game:end` payload includes correct genre
- [ ] `game:restarted` payload includes correct genre

### Lobby display
- [ ] All connected players (host and non-host) see the genre label in LobbyScreen
- [ ] Genre in LobbyScreen comes from Redux `game.genre`, populated by `lobby:updated`
- [ ] NameEntryScreen displays genre (from `GET` response) before nickname is submitted
- [ ] `lobby:updated` payload always includes `genre`

### Start-game behavior
- [ ] `game:start` sources questions exclusively from `game.config.genre` bank
- [ ] `game:start` does not re-read or accept genre from the socket payload
- [ ] Questions are shuffled from the correct genre bank
- [ ] Existing `emitQuestion` and round-progression logic is unchanged

### Restart behavior
- [ ] `game:restart` resets all session state (unchanged)
- [ ] `game:restart` does NOT reset `game.config.genre`
- [ ] `game:restarted` includes genre in payload
- [ ] Client `resetRound` preserves `genre` in Redux
- [ ] After restart, lobby shows the same genre as before

### Post-game / results behavior
- [ ] ResultsScreen shows genre label
- [ ] Genre in results comes from Redux (populated by `game:end` dispatch)
- [ ] `lastRoundResults` (or `game:end` payload) includes genre

### Join behavior
- [ ] Joining player sees genre on NameEntryScreen before submitting nickname
- [ ] After joining, player sees genre in LobbyScreen
- [ ] Player joining a post-game (ended) room receives `game:end` with genre and sees it on ResultsScreen
- [ ] Reconnecting player receives correct genre on next `lobby:updated`

### Error handling
- [ ] Invalid genre in POST → `400` response, clear error message, no room created
- [ ] Missing genre in POST → `400` response
- [ ] Start failure due to small bank → `start:error` to host, room stays waiting, other players unaffected
- [ ] `start:error` message is displayed to host in LobbyScreen
- [ ] Host can retry `game:start` after seeing `start:error`

---

## Open Questions / Decisions

1. **Should `Mixed` questions be a hand-curated `mixed.json` or dynamically sampled from other genre files?** Spec recommends a dedicated file for v1 simplicity. If sampling is chosen, a sampling strategy (uniform distribution, weighted, etc.) needs to be agreed before implementation.

2. **How many questions per session?** Currently all questions in the bank are used. Should genre banks be sized to match the target session length, or should a session length cap be configured independently? The spec assumes all questions in the bank are used (current behavior). If a cap is introduced it belongs in the env config or constants.

3. **`MIN_QUESTIONS_PER_GENRE` value** — spec leaves this as a named constant. The actual number (e.g. 10) needs to be agreed. It should be at least the intended session length.

4. **Question schema** — the current schema `{ id, prompt, options, correctAnswer }` is sufficient. No genre field needs to be added to individual question objects since genre is implicit from the file they live in. Confirm this is acceptable.

5. **`start:error` vs `action:error`** — the spec introduces a new event name. If preferred, the existing `action:error` event could be reused. Recommend keeping them separate to allow distinct client-side handling (lobby error display vs general action error).

6. **Genre label display format** — e.g. "Science" vs "Category: Science" vs a badge component. This is a UX detail; the spec leaves it to implementation but recommends matching the existing visual language.

7. **Backwards compatibility window** — if live rooms exist when the server is deployed with this feature, those rooms will have no `game.config` (pre-feature). The temporary default-genre shim in Phase 2 handles this. Confirm how long the shim should remain before removal.

---

## Assumptions

- The current `questions.json` flat array will be replaced or supplemented with per-genre files. The schema of individual question objects remains unchanged.
- `Mixed` is treated as a first-class genre with a dedicated question file, not a computed or meta-genre in v1.
- Genre is displayed as a human-readable label on the client (e.g. "Science"), derived from the slug on the client side. No separate display-name endpoint is needed.
- Session length (number of questions per game) remains "all questions in the selected bank" for v1, consistent with current behavior.
- The `VALID_GENRES` allowlist is defined and maintained server-side in `questionBank.js`. The client renders genre options from a hardcoded matching list. There is no `/api/genres` endpoint in v1.
- All question banks must be populated before the feature ships. Spec does not cover the content creation process itself.

---

## Likely File Impact Map

| File | Change type | Summary |
|---|---|---|
| `server/data/questions.json` | Replace/retire | Replaced by per-genre files in `server/data/questions/` |
| `server/data/questions/` | New directory | One JSON file per genre + `mixed.json` |
| `server/utils/questionBank.js` | New file | Loads genre banks, exports `getQuestionsByGenre`, `VALID_GENRES` |
| `server/store/gameStore.js` | Edit | `createGame` accepts `genre`, stores in `game.config` |
| `server/routes/games.js` | Edit | POST reads/validates `genre`; GET returns `genre` |
| `server/socket/handlers/gameHandlers.js` | Edit | `game:start` reads genre, sources questions from bank; `start:error` emit; `lobby:updated` / `game:restarted` / `buildGameEnd` include genre |
| `client/src/store/gameSlice.js` | Edit | Add `genre`, `startError` fields; `setGenre`, `setStartError` reducers; update `resetRound` to preserve genre |
| `client/src/hooks/useSocketEvents.js` | Edit | Handle genre in `lobby:updated`, `game:restarted`, `game:end`; add `start:error` listener |
| `client/src/screens/HomeScreen.jsx` | Edit | Add inline genre selector; pass genre to create mutation |
| `client/src/screens/NameEntryScreen.jsx` | Edit | Display genre from `GET` response |
| `client/src/screens/LobbyScreen.jsx` | Edit | Display genre label |
| `client/src/screens/ResultsScreen.jsx` | Edit | Display genre label |
| `client/src/services/` (or inline in HomeScreen) | Edit | `createGame` service function sends `{ genre }` in POST body |
| `server/config.js` | Possibly edit | Add `MIN_QUESTIONS_PER_GENRE` constant if env-configurable (otherwise define in `questionBank.js`) |
