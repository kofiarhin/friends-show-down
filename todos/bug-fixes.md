# Bug Fix Tasks

Bugs identified from codebase review. Fix in priority order.

---

## [x] Bug 1 — Clear all timers in `deleteGame()`
**File:** `server/store/gameStore.js` — lines 44–48
**Priority:** Medium

`deleteGame()` only clears `expiryTimer`, leaving `questionTimer` and `transitionTimer` as orphans if they're still active.

**Fix:** Add `clearTimeout` calls for all three timers:
```js
function deleteGame(gameId) {
  const game = games.get(gameId);
  if (game) {
    if (game.expiryTimer) clearTimeout(game.expiryTimer);
    if (game.questionTimer) clearTimeout(game.questionTimer);
    if (game.transitionTimer) clearTimeout(game.transitionTimer);
  }
  games.delete(gameId);
}
```

---

## [x] Bug 2 — Fix leaderboard tiebreaker sort direction
**File:** `server/store/leaderboardStore.js` — line 9
**Priority:** Low–Medium

Tiebreaker sorts `gamesPlayed` ascending, so players with *fewer* games rank higher. Should be descending to reward more participation.

**Fix:**
```js
// Before
if (a.gamesPlayed !== b.gamesPlayed) return a.gamesPlayed - b.gamesPlayed;

// After
if (a.gamesPlayed !== b.gamesPlayed) return b.gamesPlayed - a.gamesPlayed;
```

---

## [x] Bug 3 — Add `game.status` guard to `endQuestion()`
**File:** `server/socket/handlers/gameHandlers.js` — line 640
**Priority:** Medium

`endQuestion()` has no check that the game is actually `"in-progress"`. A stale timer firing after a `game:restart` (game now `"waiting"`) would corrupt state and broadcast a spurious `question:end` to all clients.

**Fix:** Add a status guard at the top of the function:
```js
function endQuestion(io, gameId, winnerId, winnerNickname) {
  const game = getGame(gameId);
  if (!game || game.status !== "in-progress") return;
  // ...
}
```

---

## [x] Bug 4 — Call `clearTimeout` before nulling timers in `game:restart`
**File:** `server/socket/handlers/gameHandlers.js` — lines 395–396
**Priority:** Low

The restart handler sets `game.questionTimer = null` and `game.transitionTimer = null` without calling `clearTimeout` first. Other handlers (e.g. `game:end-early`, `game:leave`) do this correctly.

**Fix:**
```js
// Before
game.questionTimer = null;
game.transitionTimer = null;

// After
if (game.questionTimer) { clearTimeout(game.questionTimer); game.questionTimer = null; }
if (game.transitionTimer) { clearTimeout(game.transitionTimer); game.transitionTimer = null; }
```

---

## [x] Bug 5 — Dispatch `setPlayState("running")` in `onGameResumed`
**File:** `client/src/hooks/useSocketEvents.js` — line 141
**Priority:** Medium (user-facing)

When the host resumes a paused game, `onGameResumed` only dispatches `resumeQuestion` (which updates `timeLimit`). It never dispatches `setPlayState("running")`, so the Redux `playState` stays `"paused"` and the pause overlay on `GameScreen` doesn't dismiss correctly.

**Fix:**
```js
function onGameResumed({ remainingTimeMs }) {
  dispatch(setPlayState("running"));                        // add this line
  dispatch(resumeQuestion(Math.ceil(remainingTimeMs / 1000)));
}
```
> `setPlayState` is already imported at line 13 — no new imports needed.
