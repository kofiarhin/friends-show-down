# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Commands

```bash
# Development (runs client + server concurrently)
npm run dev

# Run server only (nodemon)
npm run server

# Run client only (Vite)
npm run client

# Production
npm run start

# Tests
npm run test           # Jest (server)
npm run test:client    # Vitest (client)

# Lint
cd client && npm run lint
```

**Running a single test file:**
```bash
npx jest server/store/gameStore.test.js     # server
cd client && npx vitest run src/store/gameSlice.test.js  # client
```

## Environment Variables

**Root `.env` (server):**
```
PORT=3001
CLIENT_URL=http://localhost:5173
QUESTION_TIME_LIMIT=20
```

**`client/.env`:**
```
VITE_API_URL=http://localhost:3001
```

`server/config.js` validates `CLIENT_URL` and `QUESTION_TIME_LIMIT` at startup and throws if missing. The Vite proxy (`/api` and `/socket.io` → `localhost:3001`) is dev-only — all code must use `VITE_API_URL` from `client/src/config.js` as the source of truth.

## Architecture

### Monorepo Structure

Root `package.json` manages both client and server. Server has no separate `package.json` — it uses root dependencies.

### Server

- **`server/app.js`** — Express setup (CORS, routes)
- **`server/server.js`** — HTTP server + Socket.IO init
- **`server/config.js`** — Env validation and exports (`port`, `clientUrl`, `allowedOrigins`, `questionTimeLimit`)
- **`server/store/gameStore.js`** — In-memory `Map<gameId, Game>`. No database persistence. Games auto-expire via timers (30 min idle, 15 min post-end).
- **`server/routes/games.js`** — REST: `POST /api/games` (create), `GET /api/games/:gameId` (validate)
- **`server/socket/`** — Socket.IO handlers split into `gameHandlers.js` (join, start, disconnect) and `questionHandlers.js` (answer submission, scoring)
- **`server/data/questions.json`** — Trivia question bank

### Client

- **`client/src/config.js`** — Exports `apiBase` and `socketUrl` derived from `VITE_API_URL`
- **`client/src/socket.js`** — Singleton Socket.IO client (auto-connects)
- **`client/src/store/`** — Redux store; `gameSlice.js` holds all game UI state
- **`client/src/hooks/useSocketEvents.js`** — Subscribes to all socket events, dispatches Redux actions, handles navigation
- **`client/src/screens/`** — Full-page views; routing lives in `App.jsx`

### Game Flow

```
HomeScreen (/) → NameEntryScreen (/game/:id/join) → LobbyScreen (/game/:id/lobby)
  → GameScreen (/game/:id/play) → ResultsScreen (/game/:id/results)
```

REST calls handle game creation and validation. All gameplay (join, start, answer, scoring, question cycling) is driven entirely by Socket.IO events.

### Socket Event Contract

| Direction | Event | Trigger |
|---|---|---|
| Client → Server | `game:join` | Player submits nickname |
| Client → Server | `game:start` | Host starts game |
| Client → Server | `answer:submit` | Player clicks answer |
| Server → Client | `lobby:updated` | Player joins/leaves waiting room |
| Server → Client | `question:start` | New question (includes shuffled options + timer) |
| Server → Client | `question:end` | Winner + correct answer + updated scores |
| Server → Client | `game:end` | Final rankings |
| Server → Client | `game:closed` | Host disconnected |
| Server → Client | `join:error` | Invalid game/nickname/status |
| Server → Client | `answer:rejected` | Incorrect or duplicate answer |

### State Management

- **Redux** (`gameSlice`) — `gameId`, `playerId`, `nickname`, `isHost`, `status`, `players`, `currentQuestion`, `lastResult`, `hasAnswered`
- **TanStack Query** — Initialized but not actively used; intended for REST calls (game creation, validation)
- No server state in Redux; no API calls inside components

## Engineering Rules (from CLAUDE-01.md)

- Never rely on Vite proxy as primary API strategy — use `VITE_API_URL`
- Never trust client input on the backend
- Never mix server state into Redux
- Never place API request logic inside React components
- Never hard-code endpoints, ports, or origins
- Errors must be handled explicitly — no silent failures, no unhandled rejections
