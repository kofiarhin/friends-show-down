# Friends Showdown MVP

## Summary

Friends Showdown is a speed-based real-time multiplayer trivia game. A host creates a game session, shares a link, and players join via that link with a nickname. Once the host starts the game, questions are broadcast one at a time to all players simultaneously. Each player gets exactly one answer submission per question. The first player to submit the correct answer wins that question and scores 1 point; the question ends immediately for everyone. If no player submits the correct answer before the timer expires, no one scores for that question. The session continues until all questions have been played, then a final leaderboard is shown. This spec covers the full MVP end to end: architecture, screens, routes, components, backend structure, Socket.IO event contracts, game lifecycle, lobby behavior, scoring rules, validation, edge cases, reconnection, API boundaries, state management, and testing scope.

---

## Goal

A working, deployable MVP where a host can create a game, players can join via link, play through all questions in a session in real time, and see a final leaderboard — all without accounts or authentication.

---

## Non-Goals

- User accounts, auth, or persistent profiles
- Custom question creation by hosts or players
- Spectator mode
- Chat or messaging
- Persistent game history or database storage (in-memory server state is sufficient for MVP)
- Mobile-native app
- Accessibility beyond baseline semantic HTML
- Admin tooling

---

## Problem

There is no working application yet. The repo has a bare scaffold. This spec defines everything needed to build the MVP from the ground up.

---

## Users / Actors

- **Host** — creates the game, controls lobby start, sees the same game screen as players
- **Player** — joins via link, enters nickname, plays the game
- Note: the host is also a player. The host joins their own game automatically after creating it.

---

## Core Requirements

1. The home screen lets a user create a new game or join an existing game via a game ID or URL.
2. On game creation, the backend generates a unique game ID and returns a shareable URL.
3. The host is redirected to the lobby immediately after creating a game. They are prompted to enter a nickname on the way.
4. Players who follow the shared link are taken to a name entry screen, then the lobby.
5. The lobby shows a list of all connected players and a share link. Only the host sees a "Start Game" button.
6. The host can start the game only when at least 2 players are in the lobby (including the host).
7. On game start, the backend shuffles the full question bank to form the session question set and broadcasts the first question to all players.
8. All players see the same question at the same time with the same answer options.
9. Each player may submit exactly one answer per question. Once submitted (correctly or incorrectly), that player's answer buttons lock for the remainder of that question.
10. The first player to submit the correct answer wins that question and scores 1 point. The server ends the question immediately for all players upon receiving the first correct answer.
11. After a question ends (correct answer received or timer expires), the backend broadcasts the question result (who answered correctly, what the correct answer was, current scores).
12. The session continues until all questions in the session have been played. After the last question, the game ends and all players are redirected to the results screen.
13. The results screen shows the final ranked leaderboard. The player with the highest total score wins. Ties are allowed.
14. Nicknames must be unique within a game session. Duplicates are rejected.
15. Players who disconnect mid-game remain on the scoreboard but cannot answer. Their slot is preserved if they reconnect.
16. A player who disconnects and reconnects to the same game (same nickname) is restored to their previous state.

---

## User Flows

### Flow 1 — Host Creates and Starts a Game

1. Host lands on Home Screen (`/`).
2. Host clicks "Create Game".
3. Frontend calls `POST /api/games` → backend returns `{ gameId, gameUrl }`.
4. Frontend redirects host to `/game/:gameId/join` (Name Entry Screen).
5. Host enters nickname, submits.
6. Frontend emits `game:join` with `{ gameId, nickname, isHost: true }`.
7. Backend validates nickname, registers host in game session, emits `lobby:updated` to the room.
8. Host is redirected to `/game/:gameId/lobby`.
9. Host sees the lobby with the share link and their own name listed.
10. Host waits for players to join. Player list updates in real time.
11. Once 2+ players are present, "Start Game" button becomes active.
12. Host clicks "Start Game" → emits `game:start` with `{ gameId }`.
13. Backend validates host role, shuffles the full question bank to form the session question set, emits `question:start` to all players in room.
14. All clients navigate to `/game/:gameId/play`.

### Flow 2 — Player Joins via Link

1. Player opens shared URL: `http://localhost:5173/game/:gameId/join`.
2. Player sees Name Entry Screen.
3. Player enters nickname, submits.
4. Frontend emits `game:join` with `{ gameId, nickname, isHost: false }`.
5. Backend validates: game exists, game status is `waiting`, nickname not taken.
6. Backend adds player to session, emits `lobby:updated` to room.
7. Player is redirected to `/game/:gameId/lobby`.
8. Player sees all connected players and the share link. No "Start Game" button.

### Flow 3 — Gameplay Question

1. `question:start` event received by all clients: `{ questionNumber, totalQuestions, question: { id, prompt, options }, timeLimit }`.
2. Game Screen renders the question and 4 answer options. A countdown timer starts.
3. Player clicks an answer → frontend optimistically locks that player's answer buttons, then emits `answer:submit` with `{ gameId, questionNumber, answer }`.
4. Backend checks: (a) player has not already submitted for this question, (b) the question is still active, (c) the answer is evaluated.
5. If first correct answer: backend records the scorer, cancels the question timer, emits `question:end` to all players. The question ends immediately.
6. If wrong answer: backend emits `answer:rejected` with `{ reason: "Incorrect" }` to that player only. Their buttons remain locked — they have used their one submission. The question continues for players who have not yet submitted.
7. If the question is already over (race condition — answer arrived after `question:end` was already emitted): backend emits `answer:rejected` with `{ reason: "Question already over" }` to that player only.
8. `question:end` payload: `{ questionNumber, winnerId, winnerNickname, correctAnswer, scores: [{ playerId, nickname, score }] }`.
9. Clients show question result overlay (who scored, correct answer, current leaderboard).
10. After a short delay (3 seconds), if more questions remain in the session, backend emits next `question:start`.
11. If all questions are exhausted, backend emits `game:end` with final scores.
12. All clients navigate to `/game/:gameId/results`.

### Flow 4 — No One Answers (Timeout)

1. Timer on the server reaches 0 with no correct answer.
2. Backend emits `question:end` with `{ winnerId: null, winnerNickname: null, correctAnswer, scores }`.
3. Clients show "No one got it!" overlay with the correct answer.
4. After delay, next question begins or session ends.

### Flow 5 — Player Disconnects Mid-Game

1. Player socket disconnects.
2. Backend detects disconnect, marks player as `disconnected: true` in session.
3. Backend emits `players:updated` to remaining players.
4. Player's score is preserved. They cannot answer while disconnected.
5. If player reconnects within the same game (by visiting the URL and rejoining with the same nickname), they are restored.

---

## Functional Details

### UI / Pages / Components

**Home Screen** (`/`)
- "Create Game" button — calls `POST /api/games`, then redirects to name entry.
- "Join Game" input + button — accepts a game ID or full URL, strips to game ID, redirects to `/game/:gameId/join`.

**Name Entry Screen** (`/game/:gameId/join`)
- Single text input for nickname.
- Submit button.
- On submit: emits `game:join`. On success: redirect to lobby. On error: show inline error message.
- Shows game ID / code so player knows which game they're joining.

**Lobby Screen** (`/game/:gameId/lobby`)
- Player list (nickname + connected indicator).
- Share link with a copy button.
- Host only: "Start Game" button (disabled until 2+ players).
- Real-time updates via socket (`lobby:updated`).

**Game Screen** (`/game/:gameId/play`)
- Session progress counter: "Question X of Y".
- Countdown timer (visual bar or number).
- Question prompt.
- 4 answer option buttons.
- Each player gets one submission per question. Answer buttons lock immediately on click — whether the answer is correct or wrong. There is no second attempt.
- After submitting a wrong answer, the player sees their buttons locked and waits for the question to resolve (either another player answers correctly or the timer expires).
- Question result overlay after `question:end` (shows correct answer, who scored, current scores).
- Mini leaderboard visible during question result.

**Results Screen** (`/game/:gameId/results`)
- Final ranked leaderboard (rank, nickname, score).
- Winner highlight (first place, or "It's a tie!" if multiple share the top score).
- "Play Again" button — redirects everyone to `/`.

---

### Routing / Navigation

| Path | Component | Who |
|---|---|---|
| `/` | HomeScreen | Anyone |
| `/game/:gameId/join` | NameEntryScreen | Anyone with link |
| `/game/:gameId/lobby` | LobbyScreen | Joined players |
| `/game/:gameId/play` | GameScreen | Joined players |
| `/game/:gameId/results` | ResultsScreen | All players |

- Navigation between lobby → play → results is driven by socket events, not user actions (except the initial host trigger).
- If a player lands on `/game/:gameId/lobby` or `/play` without being registered in the session (no socket state), redirect them to `/game/:gameId/join`.
- React Router v6 with `useNavigate` for programmatic navigation on socket events.

---

### State Management Split

**Redux Toolkit (UI / client-owned global state)**

Slice: `gameSlice`
- `gameId` — current game ID
- `playerId` — socket-assigned ID for this client
- `nickname` — this player's nickname
- `isHost` — whether this client is the host
- `status` — `idle | waiting | in-progress | ended`
- `players` — array of `{ playerId, nickname, score, connected }`
- `currentQuestion` — `{ questionNumber, totalQuestions, question, timeLeft }`
- `lastQuestionResult` — `{ winnerId, winnerNickname, correctAnswer, scores }`
- `hasAnswered` — boolean for the current question

**TanStack Query (server fetch state)**

- `POST /api/games` — used once to create a game (mutation)
- `GET /api/games/:gameId` — used to validate a game exists before name entry (query)

No TanStack Query for live gameplay. All gameplay state flows through Redux via socket event handlers.

---

### Backend Structure

```
server/
  server.js          # Express + Socket.IO bootstrap
  app.js             # Express app, routes mounted here
  routes/
    games.js         # REST routes: POST /api/games, GET /api/games/:gameId
  socket/
    index.js         # Socket.IO setup, attaches handlers
    handlers/
      gameHandlers.js      # game:join, game:start
      questionHandlers.js  # answer:submit, question timers
  store/
    gameStore.js     # In-memory Map of active game sessions
  data/
    questions.json   # Question bank
  utils/
    generateId.js    # Generates unique game IDs (nanoid or uuid)
    shuffleArray.js  # Randomise question set and options
```

**In-memory game session structure:**

```js
{
  gameId: "abc123",
  hostId: "socketId",
  status: "waiting" | "in-progress" | "ended",
  players: [
    { playerId: "socketId", nickname: "Alice", score: 0, connected: true }
  ],
  session: {
    questions: [],        // ordered, shuffled question set for this session
    current: 0,           // index of the active question (0-based)
    totalQuestions: 0     // set at game start from questions.length
  },
  currentQuestion: null,
  questionAnswered: false,       // true once first correct answer received
  questionSubmissions: new Set() // playerIds who have submitted for this question
}
```

---

### API Endpoints

**POST /api/games**
- Body: none
- Response: `{ gameId: string, gameUrl: string }`
- Creates a new game session in the in-memory store with status `waiting`.
- `gameUrl` = `http://<host>/game/:gameId/join`

**GET /api/games/:gameId**
- Response: `{ gameId, status, playerCount }` or `404`
- Used by the name entry screen to confirm the game exists and is joinable before showing the form.
- Returns `409` if game status is `in-progress` or `ended`.

---

### Socket.IO Events

All events scoped to a game room identified by `gameId`.

#### Client → Server

| Event | Payload | Description |
|---|---|---|
| `game:join` | `{ gameId, nickname, isHost }` | Player registers in a game session |
| `game:start` | `{ gameId }` | Host triggers game start |
| `answer:submit` | `{ gameId, questionNumber, answer }` | Player submits an answer for the current question |

#### Server → Client (room broadcasts unless noted)

| Event | Payload | Who receives | Description |
|---|---|---|---|
| `lobby:updated` | `{ players }` | Room | Player list changed |
| `join:error` | `{ message }` | Sender only | Nickname taken, game not found, game already started |
| `question:start` | `{ questionNumber, totalQuestions, question: { id, prompt, options }, timeLimit }` | Room | New question begins |
| `answer:rejected` | `{ reason }` | Sender only | Wrong answer (player used their one submission) or question already over (race condition) |
| `question:end` | `{ questionNumber, winnerId, winnerNickname, correctAnswer, scores }` | Room | Question resolved |
| `game:end` | `{ scores, winnerId, winnerNickname }` | Room | All questions in session exhausted |
| `game:closed` | `{ reason }` | Room | Host disconnected while session was in `waiting`; clients redirect to `/` |
| `players:updated` | `{ players }` | Room | A player disconnected/reconnected mid-game |

---

### Game Lifecycle Rules

1. Game is created with status `waiting`.
2. Players join via `game:join`. Lobby emits `lobby:updated` on every join.
3. Host emits `game:start`. Backend validates: sender is host, status is `waiting`, player count >= 2.
4. Status changes to `in-progress`. Backend shuffles the full question bank to form `session.questions`, sets `session.current = 0`, `session.totalQuestions = session.questions.length`.
5. Backend stores the first question in `currentQuestion`, sets `questionAnswered = false`, clears `questionSubmissions`, emits `question:start` with `questionNumber: 1`.
6. Server starts a question timer (default: 20 seconds). Timer is cleared if a correct answer arrives first.
7. On `answer:submit`: if player is already in `questionSubmissions`, reject with `answer:rejected`. Otherwise, add player to `questionSubmissions`, then evaluate the answer.
8. If the submitted answer is correct and `questionAnswered = false`: mark `questionAnswered = true`, cancel timer, add 1 to scorer's score, emit `question:end` to all players.
9. If the submitted answer is wrong: emit `answer:rejected` with `{ reason: "Incorrect" }` to that player. The question continues for players not yet in `questionSubmissions`.
10. If timer expires with `questionAnswered = false`: emit `question:end` with `winnerId: null`.
11. After a 3-second delay: if `session.current < session.totalQuestions - 1`, increment `session.current`, load next question, reset `questionAnswered` and `questionSubmissions`, emit next `question:start`. Else emit `game:end`, set status `ended`.
12. Once `ended`, `answer:submit` and `game:start` are rejected.

---

### Scoring Rules

- Each player gets exactly one answer submission per question.
- 1 point is awarded to the first player whose correct answer is received by the server. The question ends immediately for all players.
- A wrong answer scores 0 and locks out only the submitting player for the remainder of that question. Other players who have not yet submitted may still answer.
- Only one player can score per question.
- Simultaneous correct answers: the server processes socket events serially. First received wins. No tie is possible within a single question.
- If no player submits the correct answer before the timer expires, no one scores for that question.
- Final ranking: descending by total score. Equal scores = tied rank.

---

### Validation

**Name Entry**
- Nickname: required, 1–20 characters, trimmed, no leading/trailing whitespace.
- Nicknames are case-insensitively unique within a game (store and compare lowercased).

**Game Join**
- Game must exist in the store.
- Game status must be `waiting`.
- Nickname must not be taken (case-insensitive).

**Game Start**
- Emitting socket must be the registered host.
- Game status must be `waiting`.
- Player count must be >= 2.

**Answer Submit**
- Game must be `in-progress`.
- Question number in payload must match `session.current + 1` (1-based).
- Player must not already be in `questionSubmissions`. One submission per player per question, regardless of whether it was correct or wrong. Reject with `answer:rejected` if already submitted.
- If `questionAnswered = true` (question already resolved), reject with `answer:rejected { reason: "Question already over" }`.

---

### Reconnection Handling

- On disconnect: mark player `connected: false` in session. Emit `players:updated` to room.
- Player slot and score are preserved.
- On reconnect: player visits `/game/:gameId/join`, enters same nickname.
- Backend identifies the player by `gameId + nickname` (case-insensitive). If a matching player record exists with `connected: false`: update the stored `playerId` to the new socket ID, set `connected: true`, emit `players:updated` to the room.
- If game is `in-progress`, emit current question state to the reconnected socket so the client can navigate to the game screen.
- If the reconnecting player was the host: update `hostId` to the new socket ID.
- If game is `ended`, redirect reconnected player to results screen directly.

---

### Questions Data

File: `server/data/questions.json`

```json
[
  {
    "id": "q1",
    "prompt": "What is the capital of France?",
    "options": ["Berlin", "Madrid", "Paris", "Rome"],
    "correctAnswer": "Paris"
  }
]
```

- The full question bank is shuffled at session start to form the session question set.
- Options order is randomised per question on the server before broadcasting (so option index is not a valid cheat vector).
- `correctAnswer` is never sent to clients in `question:start`. It is only revealed in `question:end`.
- All questions in the bank are used each session. Each question appears exactly once per session.

---

### Frontend Component Tree (approximate)

```
App
├── HomeScreen
├── NameEntryScreen
├── LobbyScreen
│   ├── PlayerList
│   └── ShareLink
├── GameScreen
│   ├── SessionProgress
│   ├── QuestionCard
│   ├── AnswerOptions
│   ├── CountdownTimer
│   └── QuestionResultOverlay
│       └── MiniLeaderboard
└── ResultsScreen
    └── FinalLeaderboard
```

---

### Socket Initialization (Frontend)

- Single socket instance created at app boot, stored in a module-level singleton (`client/src/socket.js`).
- Socket event listeners set up in a `useSocketEvents` custom hook, mounted once per screen that needs them.
- Socket emits dispatched via Redux Thunks or directly from component event handlers.
- On socket `connect`, store `socket.id` in Redux as `playerId`.

---

## States and Edge Cases

| State / Case | Behavior |
|---|---|
| Player joins with duplicate nickname | `join:error` emitted to that socket. Form shows error message. |
| Player joins after game started | `join:error`: "Game already in progress." Redirect to `/`. |
| Game ID not found (bad URL) | `GET /api/games/:gameId` returns 404. Name entry shows "Game not found." |
| Host refreshes lobby | Host's socket disconnects. Host must navigate back to `/game/:gameId/join` and re-enter their nickname. Backend matches by `gameId + nickname` (case-insensitive), updates the stored player record with the new socket ID, updates `hostId`, and sets `connected: true`. Host regains the "Start Game" button and full host privileges. |
| Only 1 player in lobby, host clicks Start | Button is disabled. No event emitted. |
| Player submits answer after question is already over (race condition) | `answer:rejected` with `reason: "Question already over"`. UI does nothing further; buttons were already locked client-side. |
| Player tries to submit a second answer | Rejected server-side (`questionSubmissions` check). Client should never allow this — buttons lock on first click. |
| Player answers with wrong answer | `answer:rejected` with `reason: "Incorrect"`. That player's buttons stay locked for the rest of the question. Other players who have not yet submitted may still answer. |
| All players submit wrong answers | All players are locked out. Question runs to timer expiry. `question:end` fires with `winnerId: null`. |
| Host disconnects while game is `waiting` | Backend emits `game:closed` to all players in the lobby. Session is removed from the store. All clients redirect to `/`. |
| Host disconnects mid-game (`in-progress`) | Mark as `connected: false`. Session continues — timer drives progression automatically. Host role is preserved. If host reconnects (matching `gameId + nickname`), their stored record is updated with the new socket ID and they regain host privileges. |
| All players disconnect | Session remains in the store subject to expiry timers (30 min for `waiting`, 15 min for `ended`). Players can reconnect within that window. |
| Slow client misses `question:start` | On reconnect, server re-emits current question state to that socket. |
| `game:end` received while on game screen | Navigate to results screen. |
| Results screen accessed without finishing game | If game status is not `ended`, redirect to appropriate screen based on status. |

---

## Technical Notes

- **No database for MVP.** All game state lives in a `Map` in `server/store/gameStore.js`. Sessions are lost on server restart.
- **Socket.IO rooms** map 1:1 to game IDs. Use `io.to(gameId).emit(...)` for broadcasts and `socket.emit(...)` for targeted messages.
- **Question timer** lives on the server (`setTimeout`), not the client. Client timer is visual only and may drift. Server is authoritative.
- **Session question set** is determined at `game:start` by shuffling the full question bank. `session.totalQuestions` equals the number of questions in `questions.json`.
- **`socket.id` as `playerId`** — use socket ID as player ID on initial join. On reconnect, the player is identified by `gameId + nickname` (matched case-insensitively). The stored player record's `playerId` is updated to the new socket ID. There is no attempt to preserve or reuse the original socket ID.
- **In-memory session cleanup** — sessions are not kept indefinitely. `waiting` sessions expire after 30 minutes of inactivity (no `game:start` received). `ended` sessions expire after 15 minutes. Use `setTimeout` per session, reset on activity where appropriate. On expiry, remove the session from the store.
- **CORS** — configure Express CORS and Socket.IO CORS to allow `http://localhost:5173` for local dev.
- **Environment variables** — `PORT`, `CLIENT_URL`, `QUESTION_TIME_LIMIT` (default 20s) stored in `.env`.
- **nanoid** (or `crypto.randomUUID`) for generating unique 6-character game IDs. Collision check against the store before confirming.
- **Vite proxy** — configure `vite.config.js` to proxy `/api` and `/socket.io` to `http://localhost:3001` to avoid CORS issues in dev.
- **Redux DevTools** — enable in development only.
- **Socket.IO client** — import from `socket.io-client`. Single instance exported from `client/src/socket.js`.

---

## Testing Scope

### Backend — Jest + Supertest

| Test file | What to cover |
|---|---|
| `routes/games.test.js` | POST creates game, returns gameId + gameUrl; GET returns 200 for valid game, 404 for unknown, 409 for started game |
| `store/gameStore.test.js` | createGame, getGame, addPlayer, updateScore, markDisconnected |
| `socket/handlers/gameHandlers.test.js` | join validates nickname uniqueness, rejects join if game in progress, host detection |
| `socket/handlers/questionHandlers.test.js` | first correct answer scores and emits question:end immediately; second submission from same player rejected regardless of correctness; wrong answer emits answer:rejected and does not end question; timer expiry emits question:end with no winner; question:end advances to next question or emits game:end when session exhausted; questionSubmissions cleared at start of each question |
| `utils/generateId.test.js` | generates string, unique across calls |

### Frontend — Vitest

| Test file | What to cover |
|---|---|
| `HomeScreen.test.jsx` | Renders create/join buttons, create triggers POST, join redirects with gameId |
| `NameEntryScreen.test.jsx` | Validates empty/too-long nickname, submits on valid input, shows join:error |
| `LobbyScreen.test.jsx` | Renders player list, hides Start for non-host, disables Start below 2 players, enables Start at 2+ |
| `GameScreen.test.jsx` | Renders question/options on question:start; shows "Question X of Y" progress; buttons lock immediately on click (before server response); buttons remain locked after answer:rejected (wrong answer); question result overlay shows on question:end; hasAnswered state prevents re-submission |
| `ResultsScreen.test.jsx` | Renders sorted leaderboard, highlights winner, shows tie label when applicable |
| `gameSlice.test.js` | All reducer actions: setGame, addPlayer, updateScores, setCurrentQuestion, setQuestionResult, setHasAnswered |
| `useSocketEvents.test.js` | Dispatches correct Redux actions on each socket event |

---

## Acceptance Criteria

- [ ] `POST /api/games` returns a unique `gameId` and a `gameUrl` pointing to `/game/:gameId/join`
- [ ] `GET /api/games/:gameId` returns game info for a valid ID and 404 for unknown IDs
- [ ] Host creates a game and lands in the lobby after entering a nickname
- [ ] Player opens the share link, enters a nickname, and appears in the host's lobby player list in real time
- [ ] Duplicate nickname emits `join:error` and the form shows the error without navigating
- [ ] Joining a game that is in-progress emits `join:error` and user is redirected to home
- [ ] "Start Game" button is disabled with fewer than 2 players and enabled at 2+
- [ ] Only the host sees the "Start Game" button
- [ ] Clicking "Start Game" broadcasts the first question to all players and navigates them to the game screen
- [ ] Answer options appear in randomised order for each question
- [ ] Correct answer is not in the `question:start` payload
- [ ] Each player can submit exactly one answer per question; buttons lock immediately on click regardless of whether the answer is correct or wrong
- [ ] First player to submit a correct answer receives a point and the question ends immediately for all players
- [ ] A player who submits a wrong answer receives `answer:rejected`; their buttons remain locked; the question continues for players who have not yet submitted
- [ ] A player cannot submit a second answer for the same question; a duplicate submission is rejected server-side
- [ ] Question result overlay shows correct answer, winner nickname (or "No one"), and current scores
- [ ] If no one answers before timer expires, `question:end` fires with `winnerId: null`
- [ ] Session advances automatically through every question in the question bank
- [ ] After all questions are exhausted, `game:end` is emitted and all players navigate to the results screen
- [ ] Game Screen shows current question number and total questions in session
- [ ] Results screen shows players ranked by total score, descending
- [ ] Tied players share a rank; winner display shows "It's a tie!" if multiple players share top score
- [ ] Player disconnects mid-game: their score is preserved and they appear as disconnected in the player list
- [ ] Reconnected player with matching nickname is restored to their session
- [ ] All backend route tests pass with Jest + Supertest
- [ ] All frontend component and slice tests pass with Vitest

---

## Open Questions

- Should the host count as a player and be able to answer questions, or should they be a pure moderator? (Assumption: host plays too.)
- Should there be a manual "Next Question" button for the host, or is progression fully automatic? (Assumption: fully automatic via server timer.)
- What is the question time limit? (Assumption: 20 seconds, configurable via `.env`.)

---

## Assumptions

- The host is also a player and can answer questions.
- Question progression is automatic (timer-driven), not manual.
- Every question in `questions.json` is used each session, shuffled into a random order. Session length equals the question bank size. Configurable subset sizes are out of scope for MVP.
- Default time limit per question: 20 seconds, configurable via `QUESTION_TIME_LIMIT` in `.env`.
- No persistent storage; in-memory only for MVP.
- No authentication. Any user with a link can join.
- `socket.id` used as player ID on join. Reconnect matched by nickname.
- "Play Again" in MVP simply redirects all players to home (`/`). No in-place session reset.
- Options are shuffled server-side before broadcasting each question.
- Nicknames are case-insensitively unique within a game.
- Each player gets exactly one answer submission per question. A wrong answer locks that player out for the remainder of that question. There are no second attempts.

---

## File Naming

`_plan/friends-showdown-mvp.md`
