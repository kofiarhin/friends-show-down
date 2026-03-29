# Cheat Feature Specification

## Overview

The Cheat System adds a layer of social sabotage and theatrical chaos to Friends Showdown. Each player can earn a single-use cheat token per game, awarded randomly at the start of each question. Cheats cover four strategic archetypes: information advantage, self-boost, opponent debuff, and social deception. The system is designed to create memorable moments without breaking the game for players who are significantly behind or ahead.

Cheat activation is triggered by a secret gesture — a triple-tap on a hidden region during the hype phase (the countdown between questions). This keeps the feature discoverable by word of mouth rather than cluttering the UI for players who don't want it.

---

## Design Principles

1. **Earn, don't buy.** Tokens are awarded by random lottery on each `question:start`. No player can stockpile more than one token at a time.
2. **One token per player at a time.** Receiving a new token when you already hold one replaces the old one.
3. **No game-ending blows.** Cheats affect single-round scoring only. They cannot zero out a player's total score or permanently disable another player.
4. **Visibility spectrum is intentional.** Some cheats are visible to everyone (Scramble, Sabotage), some are private to the target (Snitch, Freeze), and one is a public theatrical reveal (Double Down). This variety creates different social dynamics.
5. **Phase-gated activation.** All cheats are activated during `question_hype` (the inter-question countdown). This is a deliberate, calm window — not mid-answer panic.
6. **Server is the authority.** All cheat effects are computed and enforced server-side. Client sends intent; server applies the effect and tells everyone what happened.
7. **Chaos Recap at the end.** The ResultsScreen shows a scrollable log of every cheat used, by whom, and what happened. Players cannot lie about it.

---

## Selected Cheat Types

### 1. The Peek (Information Advantage)

**What it does:** Reveals only the question prompt for the next question — no answer options, no correct answer — during the hype phase. The activating player gets a private head start to think.

**Why this one:** Pure information play. Rewards fast thinkers who can narrow down an answer before options appear. Does not guarantee a win. Creates paranoia among observers ("why are they so confident?").

**Phase:** `question_hype` only.
**Target:** Self.
**Visibility:** Private to activator. No broadcast; no one else knows it was used until the Chaos Recap.

---

### 2. Double Down (Self-Boost)

**What it does:** If the activating player gets the correct answer next round, they score 2 points instead of 1. If they get it wrong, nothing extra happens. After the round resolves, the server theatrically reveals the Double Down was active, even if it didn't pay off.

**Why this one:** High-risk, high-reward self-boost. Creates a "will they get it?" tension for the room. The theatrical reveal after the round makes it a moment regardless of outcome.

**Phase:** Activated in `question_hype`. Effect applied in `answer:submit`. Cleared on `question:start`.
**Target:** Self.
**Visibility:** Hidden until round ends. The `question:end` payload announces who had Double Down active.

---

### 3. The Freeze (Opponent Debuff)

**What it does:** Blocks a named target from submitting any answer for the next question. Their answer buttons are disabled client-side (enforced server-side with rejection). The target receives a private toast: "You've been frozen this round!" No one else is told in real time. Revealed in Chaos Recap.

**Why this one:** Targeted debuff with a personal, private sting. Because the rest of the room doesn't see it live, the frozen player can't complain in real time — they just have to sit there. Creates great post-game stories.

**Phase:** Activated in `question_hype`. Effect applied in `answer:submit`. Auto-cleared on `question:start` for the following question.
**Target:** Any named opponent (by `playerId`). Cannot target self. Cannot target the same player in back-to-back questions.
**Visibility:** Private to target (live toast), public in Chaos Recap.

---

### 4. The Scramble (Opponent Debuff, Visible)

**What it does:** Reshuffles a target player's answer options in a visible, animated jolt on their screen. This happens approximately 5 seconds into the active question — so it must be activated during `question_hype` and takes effect mid-question. The target's options re-randomize, with a 0.5-second shake animation. The whole room sees a broadcast: "[Player] scrambled [Target]'s options!" The target receives no time compensation (unlike the brainstorm suggestion — compensation creates complexity and can be gamed).

**Why this one:** The only cheat that visibly affects another player in real time during a question. Creates a theatrical moment the whole room witnesses. The activator gets the social satisfaction of watching it happen.

**Phase:** Activated in `question_hype`. Effect fires 5 seconds into the next `question_live` phase via a server-side `setTimeout`. Blocked if the question has already ended by the time the timer fires. Cannot be used in the final question.
**Target:** Any opponent.
**Visibility:** Broadcast to all players (who scrambled whom). Target gets a specific shake animation. Activator gets confirmation.

---

### 5. The Snitch (Score Steal, Social)

**What it does:** The activator secretly nominates a target. If that target answers correctly next round, half their points from that question are redirected to the activator instead (rounded down; minimum 0 stolen). The target receives a delayed notification after the round: "Someone snitched on you this round!" — no name revealed. The activator gets: "Your snitch paid off!" or "Your target missed — no points stolen."

**Why this one:** The most social mechanic. Creates suspicion among players ("who snitched on me?"). Because the victim doesn't know the identity, it poisons the whole room with distrust. Works especially well against the current leader.

**Phase:** Activated in `question_hype`. Effect applied during `updateScore` in `answer:submit`. Cleared per question.
**Target:** Any opponent. Cannot snitch on yourself. One snitch per question per game (only one player can snitch per round — first activation wins).
**Visibility:** Partially hidden. Outcome broadcast individually; identity of snitch never revealed live. Full reveal in Chaos Recap only.

---

## Data Model Changes

### Per-Player Shape (extends existing player object)

```js
// Added to each player object in game.players[]
cheats: {
  token: null,          // null | "peek" | "doubleDown" | "freeze" | "scramble" | "snitch"
  tokenAwardedAt: null, // question number (1-based) token was awarded, for staleness checks
  doubleDownActive: false,
  frozenForQuestion: null,  // question number (1-based) they are frozen for, or null
  lastFreezeTargetQuestion: null, // question number of the last freeze they applied (anti-repeat guard)
}
```

### Per-Game Shape (extends existing game object)

```js
// Added to game root object
cheats: {
  snitchThisQuestion: null,  // { snitcherId, targetId } | null — only one snitch per question
  scrambleThisQuestion: null, // { activatorId, targetId, fireAt } | null — pending scramble effect
  scrambleTimer: null,        // setTimeout handle for the scramble effect
  log: [],                    // Array of cheat log entries, appended throughout the game
}
```

### Cheat Log Entry Shape

```js
{
  questionNumber: Number,       // 1-based
  cheatType: String,            // "peek" | "doubleDown" | "freeze" | "scramble" | "snitch"
  activatorId: String,
  activatorNickname: String,
  targetId: String | null,
  targetNickname: String | null,
  outcome: String,              // human-readable result, set after the question resolves
}
```

### `createGame` Additions

The `createGame` function in `server/store/gameStore.js` must initialise the `cheats` block on the game object and a `cheats` block on each player when they are created via `addPlayer`.

---

## Socket Event Contract

### Client to Server

| Event | Payload | Notes |
|---|---|---|
| `cheat:activate` | `{ gameId, cheatType, targetPlayerId? }` | Sent during `question_hype` only |

`cheatType` is one of: `"peek"`, `"doubleDown"`, `"freeze"`, `"scramble"`, `"snitch"`.
`targetPlayerId` is required for `freeze`, `scramble`, and `snitch`. Must be omitted for `peek` and `doubleDown`.

### Server to Client

| Event | Direction | Payload | Notes |
|---|---|---|---|
| `cheat:token` | Server → Requester only | `{ token: "peek" \| "doubleDown" \| ... }` | Sent on each `question:start` to the player who won the lottery |
| `cheat:blocked` | Server → Requester only | `{ reason: String }` | Validation failure |
| `cheat:peek:result` | Server → Requester only | `{ prompt: String, questionNumber: Number }` | Response to a successful `peek` activation |
| `cheat:frozen` | Server → Target only | `{ questionNumber: Number }` | Target is frozen for the next question |
| `cheat:broadcast` | Server → All in room | `{ cheatType, activatorNickname, targetNickname? }` | Used for Scramble only (the one visible live cheat) |
| `cheat:round-reveal` | Server → All in room | `{ doubleDownPlayers: [{ playerId, nickname, paid: Boolean }], snitchOutcome: { snitcherNickname, targetNickname, paid: Boolean } \| null }` | Sent alongside `question:end` to reveal Double Down and Snitch outcomes for the round |
| `cheat:snitched` | Server → Target only | `{ questionNumber: Number }` | Sent to snitch target after the round resolves — no activator name |
| `cheat:chaos-recap` | Server → All in room | `{ log: CheatLogEntry[] }` | Sent alongside `game:end` |

---

## Server-Side Implementation

### New File: `server/socket/handlers/cheatHandlers.js`

This file exports a single function `registerCheatHandlers(io, socket)` which is called from `server/socket/index.js` alongside the existing handlers.

#### `cheat:activate` handler pseudocode

```
on "cheat:activate" (payload):
  validate payload shape — gameId (string), cheatType (valid enum), targetPlayerId (string|undefined)
  game = getGame(gameId)
  if not game → emit cheat:blocked { reason: "Game not found." }
  if game.status !== "in-progress" → emit cheat:blocked { reason: "Game is not active." }
  if game.roundPhase !== "question_hype" → emit cheat:blocked { reason: "Cheats can only be activated between questions." }

  activator = game.players.find(p => p.playerId === socket.id)
  if not activator → emit cheat:blocked { reason: "Player not found." }
  if activator.cheats.token !== cheatType → emit cheat:blocked { reason: "You do not hold that token." }

  switch cheatType:

    case "peek":
      nextQ = game.session.questions[game.session.current + 1]
      if not nextQ → emit cheat:blocked { reason: "No next question available." }
      activator.cheats.token = null
      appendCheatLog(game, { questionNumber: game.session.current + 2, cheatType: "peek", activatorId, activatorNickname, outcome: "peeked" })
      emit cheat:peek:result to socket { prompt: nextQ.prompt, questionNumber: game.session.current + 2 }

    case "doubleDown":
      activator.cheats.doubleDownActive = true
      activator.cheats.token = null
      appendCheatLog(game, { ..., cheatType: "doubleDown", outcome: "pending" })
      // No broadcast yet — reveal happens at question:end

    case "freeze":
      validate targetPlayerId — present, different from activator, valid player in game
      target = game.players.find(p => p.playerId === targetPlayerId)
      nextQuestionNumber = game.session.current + 2
      if activator.cheats.lastFreezeTargetQuestion === nextQuestionNumber - 1 AND target matches last frozen target:
        emit cheat:blocked { reason: "Cannot freeze the same player in back-to-back rounds." }
      target.cheats.frozenForQuestion = nextQuestionNumber
      activator.cheats.lastFreezeTargetQuestion = nextQuestionNumber
      activator.cheats.token = null
      appendCheatLog(game, { ..., cheatType: "freeze", targetId, targetNickname, outcome: "pending" })
      emit cheat:frozen to target's socket { questionNumber: nextQuestionNumber }

    case "scramble":
      validate targetPlayerId — present, different from activator, valid player in game
      if game.cheats.scrambleThisQuestion !== null → emit cheat:blocked { reason: "A scramble is already queued for this round." }
      if game.session.current + 1 >= game.session.totalQuestions - 1 → emit cheat:blocked { reason: "Cannot scramble on the final question." }
      game.cheats.scrambleThisQuestion = { activatorId: socket.id, targetId: targetPlayerId }
      activator.cheats.token = null
      appendCheatLog(game, { ..., cheatType: "scramble", targetId, targetNickname, outcome: "pending" })
      io.to(gameId).emit("cheat:broadcast", { cheatType: "scramble", activatorNickname: activator.nickname, targetNickname: target.nickname })
      // The scramble effect fires 5 seconds into question_live — handled in emitQuestion (see gameHandlers changes)

    case "snitch":
      validate targetPlayerId — present, different from activator, valid player in game
      if game.cheats.snitchThisQuestion !== null → emit cheat:blocked { reason: "Someone already called a snitch this round." }
      game.cheats.snitchThisQuestion = { snitcherId: socket.id, targetId: targetPlayerId }
      activator.cheats.token = null
      appendCheatLog(game, { ..., cheatType: "snitch", targetId, targetNickname, outcome: "pending" })
      // No feedback to activator yet; outcome revealed at question:end
```

#### Token Lottery (runs in `emitQuestion`, `gameHandlers.js`)

```
after setting up the question and before emitting question:start:

  connectedPlayers = game.players.filter(p => p.connected)
  winner = connectedPlayers[Math.floor(Math.random() * connectedPlayers.length)]
  tokenTypes = ["peek", "doubleDown", "freeze", "scramble", "snitch"]
  token = tokenTypes[Math.floor(Math.random() * tokenTypes.length)]
  winner.cheats.token = token
  winner.cheats.tokenAwardedAt = game.session.current + 1

  find winner's socket and emit cheat:token { token }
  // Do NOT include this in the general question:start broadcast
```

#### Scramble Timer (runs in `emitQuestion`, `gameHandlers.js`)

```
after emitting question:start:

  if game.cheats.scrambleThisQuestion is set:
    target = game.players.find(p => p.playerId === game.cheats.scrambleThisQuestion.targetId)
    if target and target.connected:
      game.cheats.scrambleTimer = setTimeout(() => {
        g = getGame(gameId)
        if not g or g.questionAnswered: return  // question already over
        newOptions = shuffleArray(g.currentQuestion.options)
        emit "cheat:scramble:apply" to target's socket { options: newOptions, questionNumber: g.session.current + 1 }
        // Update log outcome to "scrambled"
      }, 5000)
```

Note: The target's socket ID is used for the targeted emit. The server must look up the target's current `playerId` (which equals their `socket.id`).

#### Score Adjustments in `answer:submit` (`questionHandlers.js`)

```
on correct answer:

  // Freeze guard
  player = game.players.find(p => p.playerId === socket.id)
  if player.cheats.frozenForQuestion === game.session.current + 1:
    return socket.emit("answer:rejected", { reason: "You are frozen this round." })

  // Double Down
  scoreDelta = 1
  if player.cheats.doubleDownActive:
    scoreDelta = 2

  updateScore(gameId, socket.id, scoreDelta)

  // Snitch redirect
  if game.cheats.snitchThisQuestion?.targetId === socket.id:
    snitch = game.cheats.snitchThisQuestion
    stolen = Math.floor(scoreDelta / 2)   // 1 for normal, 1 for double-down (floor of 2 = 1)
    if stolen > 0:
      updateScore(gameId, socket.id, -stolen)       // reduce winner's points
      updateScore(gameId, snitch.snitcherId, stolen) // give to snitch
      // mark snitch log outcome as "stolen: N"
    // notify snitch target after question:end (see below)

  endQuestion(...)
```

#### `endQuestion` Additions (`gameHandlers.js`)

```
before emitting question:end:

  // Collect Double Down reveal data
  doubleDownPlayers = game.players
    .filter(p => p.cheats.doubleDownActive)
    .map(p => ({ playerId: p.playerId, nickname: p.nickname, paid: p.playerId === winnerId }))

  // Collect snitch outcome
  snitchOutcome = null
  if game.cheats.snitchThisQuestion:
    snitch = game.cheats.snitchThisQuestion
    snitcher = game.players.find(p => p.playerId === snitch.snitcherId)
    target = game.players.find(p => p.playerId === snitch.targetId)
    paid = winnerId === snitch.targetId
    snitchOutcome = { snitcherNickname: snitcher.nickname, targetNickname: target.nickname, paid }

  // Emit round reveal alongside question:end
  io.to(gameId).emit("cheat:round-reveal", { doubleDownPlayers, snitchOutcome })

  // Notify snitch target privately (no activator name)
  if game.cheats.snitchThisQuestion:
    targetSocket = io.sockets.sockets.get(snitch.targetId)
    if targetSocket: targetSocket.emit("cheat:snitched", { questionNumber: game.session.current + 1 })

after emitting question:end:

  // Clear per-question cheat state
  game.players.forEach(p => {
    p.cheats.doubleDownActive = false
    p.cheats.frozenForQuestion = null  // only cleared if it was this question — use === check
  })
  game.cheats.snitchThisQuestion = null
  game.cheats.scrambleThisQuestion = null
  if game.cheats.scrambleTimer:
    clearTimeout(game.cheats.scrambleTimer)
    game.cheats.scrambleTimer = null

  // Update log entries marked "pending" for this question number
  // (set outcome strings based on outcome computed above)
```

#### `game:end` Addition

```
emit "cheat:chaos-recap" to io.to(gameId) { log: game.cheats.log }
```

This is emitted immediately before or alongside `game:end`.

#### `game:restart` Addition (`gameHandlers.js`)

Reset the game-level cheat state and all player cheat state:

```
game.cheats = { snitchThisQuestion: null, scrambleThisQuestion: null, scrambleTimer: null, log: [] }
game.players.forEach(p => {
  p.cheats = { token: null, tokenAwardedAt: null, doubleDownActive: false, frozenForQuestion: null, lastFreezeTargetQuestion: null }
})
```

---

## Files to Change

### `server/store/gameStore.js`

- In `createGame`: add `cheats: { snitchThisQuestion: null, scrambleThisQuestion: null, scrambleTimer: null, log: [] }` to the game object.
- In `addPlayer`: add the per-player `cheats` block (see data model above) to the player object before pushing to `game.players`.
- Export a new helper `appendCheatLog(game, entry)` — appends to `game.cheats.log` and sets `outcome` on the entry. Can live in this file or in `cheatHandlers.js`.

### `server/socket/handlers/gameHandlers.js`

- In `emitQuestion`: add token lottery logic and scramble timer setup (see pseudocode above). Clear scramble timer from the previous round here as a safety measure.
- In `endQuestion`: collect Double Down and Snitch data, emit `cheat:round-reveal`, send private `cheat:snitched` notification, and clear per-question cheat state on all players.
- In `buildGameEnd`: emit `cheat:chaos-recap` before or alongside `game:end`.
- In `game:restart` handler: reset all cheat state.

### `server/socket/handlers/questionHandlers.js`

- In `answer:submit`: add freeze guard before score update. Apply Double Down `scoreDelta`. Apply snitch redirect after correct answer scored.

### `server/socket/index.js`

- Import and call `registerCheatHandlers(io, socket)` inside `io.on("connection", ...)`.

### `client/src/hooks/useSocketEvents.js`

- Add handlers for: `cheat:token`, `cheat:peek:result`, `cheat:frozen`, `cheat:broadcast`, `cheat:round-reveal`, `cheat:snitched`, `cheat:scramble:apply`, `cheat:chaos-recap`.

### `client/src/store/gameSlice.js`

Add the following state fields to `initialState`:

```js
cheatToken: null,         // null | "peek" | "doubleDown" | "freeze" | "scramble" | "snitch"
isFrozen: false,          // true if frozen for current question
cheatBroadcast: null,     // { cheatType, activatorNickname, targetNickname } | null — cleared after display
cheatRoundReveal: null,   // { doubleDownPlayers, snitchOutcome } | null — cleared at next question:start
cheatChaosRecap: null,    // CheatLogEntry[] | null — set at game:end
peekPrompt: null,         // { prompt, questionNumber } | null
snitchedThisRound: false, // true if you were snitched this round — cleared at next question:start
```

Add reducers: `setCheatToken`, `clearCheatToken`, `setIsFrozen`, `clearIsFrozen`, `setCheatBroadcast`, `setCheatRoundReveal`, `setCheatChaosRecap`, `setPeekPrompt`, `setSnitchedThisRound`. Clear `isFrozen`, `cheatRoundReveal`, `peekPrompt`, `snitchedThisRound`, `cheatBroadcast` inside `setCurrentQuestion` (which fires on `question:start`).

### New File: `server/socket/handlers/cheatHandlers.js`

Contains `registerCheatHandlers(io, socket)` — handles `cheat:activate` with all five cheat types as described above.

### New File: `client/src/components/CheatTray.jsx`

The activation UI (see UI/UX section below).

### New File: `client/src/components/CheatBroadcastBanner.jsx`

Renders the live broadcast message for Scramble. Auto-dismisses after 3 seconds.

### New File: `client/src/components/CheatRoundReveal.jsx`

Renders the post-round reveal for Double Down and Snitch outcomes. Shown in `QuestionResultOverlay` or as an overlay on `GameScreen` during `question_result` and `question_hype` phases.

### New File: `client/src/components/ChaosRecap.jsx`

Shown on `ResultsScreen`. A scrollable card below the leaderboard listing every cheat entry from `cheatChaosRecap`. Toggle-able via long-press on the trophy (or a "Show Chaos Recap" button for accessibility).

---

## UI/UX Details

### Activation: Secret Triple-Tap

During the `question_hype` phase, a hidden tap zone exists in the bottom-right corner of the screen (40x40px, no visible indicator). Triple-tapping within 600ms opens the **Cheat Tray** — a slide-up panel.

- The Cheat Tray only renders if the player holds a token (`cheatToken !== null`).
- If the player has no token, triple-tapping does nothing (no feedback).
- The tray auto-dismisses after 4 seconds if not interacted with.
- The tray contains a single large button displaying only an emoji corresponding to the cheat:
  - Peek: 👁
  - Double Down: 2️⃣
  - Freeze: 🧊
  - Scramble: 🌀
  - Snitch: 🐀
- Below the emoji: a one-line description in small text (e.g., "See the next question's prompt").
- If the cheat requires a target, tapping the button expands to show a list of connected opponent names. Tapping a name confirms activation.
- Confirmation: tray collapses, a small toast appears: "Cheat activated."

### Cheat-Specific UX

**Peek:**
- After activation: a brief "flash" shimmer on the tray closes, then a small card slides up from the bottom of the GameScreen with the next question's prompt text. Label: "You peeked." Card dismisses after 5 seconds or on tap.
- No visible change for anyone else.

**Double Down:**
- Activator sees: no immediate feedback beyond "Cheat activated."
- After the round resolves: `CheatRoundReveal` shows all players who had Double Down active. If it paid off: the player's score entry pulses with a `2x` badge for 2 seconds. If it didn't: a "Missed it" label appears next to their name.

**Freeze:**
- Target sees immediately: a full-screen toast overlay (1.5 seconds) — a blue "FROZEN" banner with ice-crystal effect. It auto-dismisses before the next question starts.
- On `question:start` while frozen: answer buttons render with a faint blue tint and `disabled`. A small label under the answer grid: "You are frozen this round."
- No live broadcast to the room.

**Scramble:**
- Broadcast banner appears for all players (except target) for 3 seconds: "[Activator] scrambled [Target]'s options!"
- Target sees no pre-warning. Five seconds into the live question, their answer options visibly shuffle with a 0.5-second shake animation (`cheat:scramble:apply`). The target's answer grid re-renders with the new option order; any button they had highlighted is deselected.
- Client receives `cheat:scramble:apply { options, questionNumber }`. The handler should verify the `questionNumber` matches the current question before applying.

**Snitch:**
- Activator: "Cheat activated" toast only. No further live feedback until round ends.
- After round: `CheatRoundReveal` shows a snitch summary for all players: "[Snitcher] set a trap." + "It paid off" / "Target missed." No target name revealed in the broadcast.
- Target: after round resolves (during `question_result` phase), receives `cheat:snitched` → private toast: "Someone snitched on you this round!"

### Frozen Answer State (GameScreen)

In `GameScreen.jsx`, when `isFrozen === true` and `roundPhase === "question_live"`, add `disabled` to all answer buttons and render a banner below the question card:

```
"You've been frozen this round. Better luck next time."
```

The `isFrozen` flag is set from `cheat:frozen` and cleared on `setCurrentQuestion` (the next `question:start`).

### CheatRoundReveal Component

Rendered inside `QuestionResultOverlay` during `question_result` and persisting through `question_hype`. It receives the `cheatRoundReveal` slice from Redux. It renders:
- A "CHEAT REPORT" header in a muted amber.
- One line per Double Down player: "[Nickname] doubled down — [PAID OFF / MISSED]".
- One line for Snitch if active: "[Snitcher] set a snitch trap — [it paid off / the target missed]".
- No lines if neither was active (component renders nothing / `null`).

### Chaos Recap (ResultsScreen)

A `ChaosRecap` component renders below the `FinalLeaderboard` on `ResultsScreen`. It shows only if `cheatChaosRecap` has at least one entry.

Layout:
- Section title: "CHAOS RECAP" in uppercase amber.
- A scrollable list (max height 300px) of log entries, sorted by `questionNumber`.
- Each entry: "Q[N] — [emoji] [activatorNickname] used [cheatType label] [on targetNickname]" — plus the outcome.
- Snitch entries fully reveal both activator and target with the outcome. This is the only moment identities are disclosed.

Example entries:
```
Q2 — 👁 laura peeked ahead
Q3 — 🐀 sam snitched on alex — it paid off (1 pt stolen)
Q4 — 🧊 priya froze dan
Q5 — 🌀 tom scrambled alex's options
Q6 — 2️⃣ dan doubled down — missed
```

The Chaos Recap is always visible (no long-press toggle required). It supplements the winner celebration rather than replacing it.

---

## Anti-Abuse Rules

1. **One token max.** A player receiving a new token while holding one has the old token silently replaced. This prevents token accumulation across pauses or reconnects.
2. **Phase gate.** `cheat:activate` is rejected if `game.roundPhase !== "question_hype"`. No mid-question activations.
3. **Self-targeting blocked.** Freeze, Scramble, and Snitch cannot target the activating player.
4. **One snitch per question.** `game.cheats.snitchThisQuestion` is checked; first activation wins. Subsequent attempts are blocked with a specific message.
5. **One scramble per question.** Same guard via `game.cheats.scrambleThisQuestion`.
6. **Freeze back-to-back guard.** A player cannot freeze the same target in consecutive questions.
7. **Scramble cannot fire on final question.** Blocked at activation time.
8. **Scramble timer is cleared if question ends early.** The `clearTimeout` in `endQuestion` prevents a scramble firing on a resolved question.
9. **Reconnect safety.** On reconnect, the server does not re-emit a cheat token. If the player held a token before disconnect, it persists on their player object. The client can re-request state via the existing reconnect flow, but no special cheat re-emit is needed — tokens are stored server-side on the player.
10. **No score floor bypass.** `updateScore` is the only mechanism to change scores. The snitch redirect uses two `updateScore` calls. If the stolen amount is 0 (e.g., target scored 0), nothing is applied.
11. **Cheat log cannot be edited.** `appendCheatLog` only appends. Outcome fields are updated by reference on the same entry object, never by replacing entries.

---

## Implementation Order

Suggested sequence to minimise risk and allow incremental testing:

1. **Data model** — update `createGame` and `addPlayer` in `gameStore.js`. Add `appendCheatLog` helper.
2. **Token lottery** — add to `emitQuestion` in `gameHandlers.js`. Add `cheat:token` event handling client-side. Verify token is received in Redux.
3. **Cheat Tray UI** — build `CheatTray.jsx` connected to `cheatToken` Redux state. Confirm it opens/closes correctly. No real activation yet.
4. **Peek** — simplest cheat. Implement server handler. Connect client. Test prompt display.
5. **Double Down** — server handler + `answer:submit` delta. `question:end` reveal. `CheatRoundReveal` component.
6. **Freeze** — server handler + `answer:submit` guard. `cheat:frozen` client handling. Frozen button state in `GameScreen`.
7. **Snitch** — server handler + `answer:submit` redirect. `cheat:round-reveal` snitch data. Private `cheat:snitched` event.
8. **Scramble** — server handler + scramble timer in `emitQuestion`. `cheat:scramble:apply` client handling. Shake animation.
9. **Chaos Recap** — `game:end` includes `cheat:chaos-recap`. `ChaosRecap.jsx` on `ResultsScreen`.
10. **`game:restart` reset** — ensure all cheat state clears correctly on restart.
11. **Tests** — add unit tests for cheat handler to `server/socket/handlers/cheatHandlers.test.js`. Test each cheat type: valid activation, blocked activation (wrong phase, no token, self-target, etc.), and score effects.
