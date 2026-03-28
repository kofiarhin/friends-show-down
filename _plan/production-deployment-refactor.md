# Production Deployment Refactor — Friends Showdown

## Summary

Friends Showdown is a real-time multiplayer quiz game with a React/Vite frontend (`client/`) and a Node.js/Express/Socket.IO backend (`server/`). The app runs correctly in development because the Vite dev server proxies `/api` and `/socket.io` to `localhost:3001`. In production, when the frontend is deployed to Vercel and the backend to Heroku, those same-origin assumptions break: the socket client connects to the Vercel origin (wrong) and all API requests go to the Vercel server (wrong). This spec covers the minimum refactor needed to make the app run correctly in production without changing any game behavior.

---

## Goal

The frontend and backend can be deployed independently to Vercel and Heroku respectively. All API calls and socket connections target the backend URL driven by `VITE_API_URL` in both development and production. After the refactor, switching between development and production should require environment variable changes only, not source code changes.

---

## Non-Goals

- No changes to game rules, socket event names, or Redux state shape.
- No introduction of a database (in-memory store remains as-is).
- No authentication or session persistence.
- No CI/CD pipeline configuration.
- No migration from `fetch()` to axios.
- No test coverage expansion beyond what is touched by this refactor.
- No changes to the root monorepo structure (single `package.json` at root is intentional per CLAUDE.md).

---

## Problem

### Current Production Failure Diagnosis

**Root cause:** `client/src/socket.js` calls `io("/")`. When running behind the Vite dev proxy this resolves to `localhost:3001`. On Vercel, `/` resolves to the Vercel origin — there is no Socket.IO server there, so the connection fails or is silently dropped.

**Secondary cause:** `HomeScreen.jsx` calls `fetch("/api/games", { method: "POST" })` and `NameEntryScreen.jsx` calls `fetch("/api/games/${gameId}")`. On Vercel these go to Vercel's CDN routing, not the Heroku backend. Requests either 404 or return HTML instead of JSON.

**Tertiary cause:** `server/routes/games.js` builds the shareable game URL using `CLIENT_URL` from the server `.env`. In production this must be set to the Vercel frontend URL or the generated join links will point to `localhost:5173`.

**Result:** On production, the host cannot create a game (API call fails), and even if the URL was navigated to directly, the socket cannot connect, so no game state is exchanged.

---

## Users / Actors

- **Host** — creates a game, starts rounds, stays in the game until it ends.
- **Player** — joins via a share link, enters a nickname, plays questions.
- Both interact entirely through the browser; neither has server-side accounts.

---

## Repo Findings

### Confirmed existing state

| File | Relevant State |
|---|---|
| `client/src/socket.js` | `io("/", ...)` — relative path, dev-proxy-dependent |
| `client/src/screens/HomeScreen.jsx` | `fetch("/api/games", ...)` — relative URL |
| `client/src/screens/NameEntryScreen.jsx` | `fetch("/api/games/${gameId}")` — relative URL |
| `client/vite.config.js` | Proxy for `/api` and `/socket.io` to `localhost:3001` |
| `server/server.js` | `CLIENT_URL` used for Socket.IO CORS |
| `server/app.js` | `CLIENT_URL` used for Express CORS |
| `server/routes/games.js` | `CLIENT_URL` used to build shareable game URL |
| `.env` | `PORT=3001`, `CLIENT_URL=http://localhost:5173`, `QUESTION_TIME_LIMIT=20` |
| `client/src/store/store.js` | Uses `import.meta.env.DEV` only — no other Vite env vars used |

### What does not exist yet

- No `VITE_API_URL` Vite environment variable or client `.env` files.
- No `client/src/config.js` or equivalent runtime config module.
- No `server/config.js` shared backend config module.
- No `.env.example` for documentation.
- No `vercel.json` or `Procfile` (to be added only if required by the actual deployment setup — see Deployment Behavior).

---

## Core Requirements

1. The frontend must read the backend base URL from `VITE_API_URL` at build time.
2. The socket client must connect to the explicit backend URL from `VITE_API_URL` in both development and production — not a relative path.
3. All `fetch()` calls in the client must use the explicit backend base URL from `VITE_API_URL` in both development and production — not relative paths.
4. Frontend endpoint configuration must normalize the base URL (strip trailing slash) to avoid malformed request paths.
5. The Vite proxy in `vite.config.js` may remain as a local-dev convenience but the app must not depend on it architecturally.
6. The backend must accept CORS from the configured frontend origin.
7. Express CORS and Socket.IO CORS must consume the same parsed origin config from `server/config.js` — no independent reads of `CLIENT_URL`.
8. `CLIENT_URL` on the server must be set to the Vercel frontend URL in production.
9. A `.env.example` file must document all required environment variables for both server and client.
10. Missing critical env vars must produce a clear startup error, not a silent runtime failure.

---

## User Flows

No changes to user flows. The same screens, routes, and game behavior apply. This refactor only changes where network requests are sent, not what happens as a result.

---

## Functional Details

### Frontend Config

Create `client/src/config.js` as the single source of truth for network endpoints.

- Always reads `import.meta.env.VITE_API_URL`.
- Normalizes the value by stripping any trailing slash so downstream concatenation (`${apiBase}/api/games`) never produces double slashes.
- Exports `apiBase` (the normalized base URL string) and `socketUrl` (same value — the socket and API share the same backend origin, so no separate variable is needed).
- If `VITE_API_URL` is missing or empty, logs `console.error("VITE_API_URL is not set. Set it in client/.env.local (dev) or Vercel environment variables (production).")` and does not throw. The app renders enough to surface the error rather than producing a blank screen.

In development `VITE_API_URL=http://localhost:3001` is set in `client/.env.local`. The socket and fetch calls resolve directly to the local backend. The Vite proxy remains in `vite.config.js` but is not the mechanism the app relies on.

In production `VITE_API_URL=https://friends-show-down-api-7fdc529d8adc.herokuapp.com` is set in Vercel environment variables. The same `config.js` code produces the correct Heroku URL without modification.

Only one env var is needed: `VITE_API_URL`. Do not add a separate `VITE_SOCKET_URL`.

### Backend Config

Create `server/config.js` as a shared config module:

- Reads `PORT`, `CLIENT_URL`, `QUESTION_TIME_LIMIT` from `process.env`.
- Validates `CLIENT_URL` and `QUESTION_TIME_LIMIT` are present; throws a descriptive error on startup if either is missing.
- Parses `CLIENT_URL` as a comma-separated string and produces `allowedOrigins` (array) for CORS, and `clientUrl` (first element of the parsed array) as the canonical frontend URL used for share-link generation.
- Exports a plain config object with the following named properties: `port`, `clientUrl`, `allowedOrigins`, `questionTimeLimit`. No logic beyond reading, validating, and normalizing env vars.

Import `server/config.js` in `server/server.js`, `server/app.js`, and `server/routes/games.js` instead of each reading `process.env.CLIENT_URL` directly.

`require("dotenv").config()` must remain at the very top of `server/server.js` before `server/config.js` is required, so dotenv populates `process.env` before validation runs.

### API Request Architecture

Update `HomeScreen.jsx` and `NameEntryScreen.jsx`:

- Import `apiBase` from `../config` (adjust relative path as needed).
- Replace `fetch("/api/games")` with `fetch(\`${apiBase}/api/games\`)`.
- Replace `fetch(\`/api/games/${gameId}\`)` with `fetch(\`${apiBase}/api/games/${gameId}\`)`.

No changes to how TanStack Query is set up or how responses are consumed beyond the response safety audit below.

**Response safety audit (verify before finalizing):** Read `HomeScreen.jsx` and `NameEntryScreen.jsx` in full before making changes. Verify:
- Does each `fetch()` call check `res.ok` before calling `.json()`? If not, add a guard.
- Does each call site handle a non-2xx response without crashing? TanStack Query will surface thrown errors as `isError` state — confirm the UI renders a visible error message rather than nothing or a crash.
- Does `NameEntryScreen.jsx` safely read `.message` from `{ message: string }` shaped error responses (404, 409)? Confirm it does not assume the shape blindly.

Add only the guards that are confirmed missing after reading the files. Do not add speculative error handling.

### Socket Architecture

Update `client/src/socket.js`:

- Import `socketUrl` from `./config`.
- Replace `io("/", { ... })` with `io(socketUrl, { ... })`.
- `socketUrl` is the explicit backend URL in both dev and production. There is no same-origin fallback in the target architecture.
- Keep `transports: ["websocket", "polling"]` unchanged.
- Keep `autoConnect: true` unchanged.

No changes to `useSocketEvents.js`, `NameEntryScreen.jsx`, `LobbyScreen.jsx`, or `GameScreen.jsx` — all socket event handlers remain identical.

### Environment Variables

#### Local development — server (`.env` at repo root)

```
PORT=3001
CLIENT_URL=http://localhost:5173
QUESTION_TIME_LIMIT=20
```

#### Local development — client (`client/.env.local`, not committed)

```
VITE_API_URL=http://localhost:3001
```

#### Heroku production (set in Heroku config vars, not in a file)

```
PORT=              # set automatically by Heroku — do not set manually
CLIENT_URL=https://<your-vercel-app>.vercel.app
QUESTION_TIME_LIMIT=20
NODE_ENV=production
```

#### Vercel production (set in Vercel project environment variables)

```
VITE_API_URL=https://friends-show-down-api-7fdc529d8adc.herokuapp.com
```

#### `.env.example` (committed at repo root)

```
# Server — copy to .env for local development
PORT=3001
CLIENT_URL=http://localhost:5173
QUESTION_TIME_LIMIT=20

# Client — copy to client/.env.local for local development
# In production, set VITE_API_URL in Vercel environment variables
VITE_API_URL=http://localhost:3001
```

### CORS / Origin Handling

`server/config.js` parses `CLIENT_URL` as a comma-separated string and exports `allowedOrigins` as an array. Both `server/app.js` and `server/server.js` consume `allowedOrigins` from this single source.

- `cors({ origin: config.allowedOrigins })` in `server/app.js`.
- `new Server(server, { cors: { origin: config.allowedOrigins, methods: ["GET", "POST"] } })` in `server/server.js`.

Local `.env`: `CLIENT_URL=http://localhost:5173`
Heroku production: `CLIENT_URL=https://<your-vercel-app>.vercel.app`

To allow both simultaneously (e.g. testing production backend from local client): `CLIENT_URL=https://<your-vercel-app>.vercel.app,http://localhost:5173`.

When `CLIENT_URL` contains multiple comma-separated origins, `config.clientUrl` is the first origin in the list and is used exclusively for share-link generation in `server/routes/games.js`. `config.allowedOrigins` (the full parsed array) is used exclusively for CORS allowlisting. The two are always derived from the same source but serve different purposes.

**Socket.IO CORS must match Express CORS.** Both now read from the same `config.allowedOrigins` — drift is no longer possible.

### Deployment Behavior

#### Vercel (frontend)

- `vite build` output is in `client/dist/`.
- Vercel must be pointed at the `client/` subdirectory as the project root, or configured via `vercel.json`.
- If the Vercel project is connected to the repo root (not `client/`), create `vercel.json` at the repo root:

```json
{
  "buildCommand": "npm run build --prefix client",
  "outputDirectory": "client/dist",
  "rewrites": [{ "source": "/(.*)", "destination": "/index.html" }]
}
```

The `rewrites` rule ensures React Router client-side routes (`/game/:gameId/join`, etc.) are handled by the SPA rather than returning 404 from Vercel's routing layer. If Vercel is configured with the `client/` folder as the project root directly, the rewrite may be configurable in the Vercel dashboard instead.

- Set `VITE_API_URL` in the Vercel project's environment variables. Vite bakes `VITE_*` vars into the bundle at build time — every deployment that changes the backend URL requires a rebuild.

#### Heroku (backend)

- The root `package.json` `start` script is `node server/server.js`. Heroku can use this directly.
- If Heroku does not detect the start script automatically, create `Procfile` at the repo root:

```
web: node server/server.js
```

- Heroku automatically sets `PORT`. `server/server.js` already reads `process.env.PORT || 3001`.
- Set `CLIENT_URL`, `QUESTION_TIME_LIMIT`, and `NODE_ENV=production` in Heroku config vars.
- `dotenv` in `server/server.js` is safe on Heroku — it silently does nothing if no `.env` file is present, and Heroku config vars take precedence.

### Validation / Fail-Fast Behavior

`server/config.js` must validate required env vars on load:

- `CLIENT_URL` — required. If missing, throw: `"Missing required env var: CLIENT_URL"`.
- `QUESTION_TIME_LIMIT` — required. If missing or NaN after `parseInt`, throw: `"Missing or invalid env var: QUESTION_TIME_LIMIT"`.
- `PORT` — optional; fall back to `3001` without error.

`client/src/config.js` must warn if `VITE_API_URL` is missing:

- Log `console.error("VITE_API_URL is not set. ...")` if `!import.meta.env.VITE_API_URL`.
- Do not throw — the app should render enough to show the error rather than a blank screen.

### Error Handling

Verify the following before finalizing changes (read the files — do not assume):

- **`HomeScreen.jsx`:** If `POST /api/games` fails (network error or non-2xx), does the UI show a visible error message? TanStack Query exposes `isError`. Confirm it is used to render feedback. Add it only if confirmed missing.
- **`NameEntryScreen.jsx`:** If `GET /api/games/:gameId` returns 404 or 409, does the UI read `.message` from the JSON response and display it? Confirm the call site does not crash if `.message` is absent. Add a guard only if confirmed missing.
- **Socket connect failure:** If the socket cannot connect (wrong URL, CORS error), Socket.IO client retries silently. No code change required. Note for future observability work.

### Local vs Production Behavior

| Concern | Development | Production |
|---|---|---|
| `VITE_API_URL` | `http://localhost:3001` | `https://friends-show-down-api-7fdc529d8adc.herokuapp.com` |
| API calls | `fetch("http://localhost:3001/api/games")` | `fetch("https://...herokuapp.com/api/games")` |
| Socket | `io("http://localhost:3001")` | `io("https://...herokuapp.com")` |
| CORS | Heroku accepts `localhost:5173` | Heroku accepts Vercel origin |
| Game URL in response | `http://localhost:5173/game/:id/join` | `https://<vercel-app>.vercel.app/game/:id/join` |
| Vite proxy | Present in `vite.config.js`, not relied on | Not present / irrelevant |

---

## States and Edge Cases

- **`VITE_API_URL` not set in `client/.env.local`:** `config.js` logs a console error. All fetch and socket calls will use `undefined` as the base URL and fail immediately. Developer sees the error in the browser console.
- **`VITE_API_URL` has a trailing slash:** `config.js` strips it. Paths like `/api/games` concatenate cleanly.
- **`VITE_API_URL` set to wrong URL in production:** Fetch calls fail with CORS or network error. TanStack Query surfaces these as `isError`. Socket retries silently. Game cannot start.
- **`CLIENT_URL` set to wrong origin on Heroku:** API and socket calls from the frontend are blocked by CORS. Browser console shows CORS errors.
- **`vercel.json` missing rewrite rule (if Vercel project is at repo root):** Direct navigation to `/game/:id/join` returns 404. React Router never mounts.
- **Socket transport fallback:** `transports: ["websocket", "polling"]` is already set. If WebSocket is blocked, polling fallback works. No change needed.
- **Heroku dyno sleep:** First API call after inactivity may be slow. Heroku plan concern, not a code concern.

---

## Technical Notes

- **`dotenv` import order:** `require("dotenv").config()` is the first line in `server/server.js`. `server/config.js` must be required after it so `process.env` is populated before validation runs.
- **Vite env baking:** `VITE_*` variables are embedded into the JS bundle at build time. Changing them post-build has no effect. Every Vercel deployment that changes the backend URL requires a fresh build.
- **`import.meta.env` in tests:** Vitest provides `import.meta.env`. The existing `store.js` already uses `import.meta.env.DEV` and tests pass. No test changes are expected from adding `import.meta.env.VITE_API_URL`.
- **No `mongoose` usage:** Mongoose is in `package.json` but is never imported or used. The game store is intentionally in-memory. Do not add persistence.
- **Single package.json at root:** The `start` script is at root level. Heroku can use it directly. Do not restructure the monorepo.
- **`VITE_API_URL` trailing slash:** Document in `.env.example` that values must not have a trailing slash. `config.js` normalizes it regardless, but the convention avoids confusion.

---

## Phased Implementation Order

### Phase 1 — Backend config consolidation

1. Create `server/config.js`: read, validate, and export `port`, `clientUrl`, `allowedOrigins`, and `questionTimeLimit`.
2. Update `server/app.js`: import from `server/config.js`; replace local `process.env.CLIENT_URL` read.
3. Update `server/server.js`: same.
4. Update `server/routes/games.js`: same.
5. Smoke test locally: `npm run dev`, create a game, join it, play a round.

### Phase 2 — Frontend config and env-driven networking

1. Create `client/.env.local` with `VITE_API_URL=http://localhost:3001`.
2. Create `client/src/config.js`: read and normalize `VITE_API_URL`; export `apiBase` and `socketUrl`; log error if missing.
3. Update `client/src/socket.js`: replace `io("/", ...)` with `io(socketUrl, ...)`.
4. Update `HomeScreen.jsx`: replace relative fetch URL with `${apiBase}/api/games`.
5. Update `NameEntryScreen.jsx`: replace relative fetch URL with `${apiBase}/api/games/${gameId}`.
6. Smoke test locally: create a game, join from a second tab, play a round — all over the explicit `http://localhost:3001` URL.

### Phase 3 — Response safety audit

1. Read `HomeScreen.jsx` in full. Verify error state from `POST /api/games` failure displays a visible message. Fix if missing.
2. Read `NameEntryScreen.jsx` in full. Verify 404/409 error responses display `.message` safely. Fix if missing.

### Phase 4 — Deployment configuration

1. Create `.env.example` at repo root.
2. Add `vercel.json` if Vercel project is connected to repo root (not `client/` directly).
3. Add `Procfile` if Heroku does not detect `npm start` automatically.
4. Deploy backend to Heroku: set `CLIENT_URL`, `QUESTION_TIME_LIMIT`, `NODE_ENV=production`.
5. Deploy frontend to Vercel: set `VITE_API_URL=https://friends-show-down-api-7fdc529d8adc.herokuapp.com`.
6. Smoke test production: create a game, share the link, join from a second device or browser, play a full round.

---

## Rollback / Risk Notes

- Phase 1 and 2 changes are local config-only. No behavioral change occurs in dev. Risk: low.
- Phase 2 changes the socket connection target from `"/"` to `"http://localhost:3001"`. These are equivalent in dev but the explicit URL must be in `client/.env.local` before testing. If the file is missing, the app will error visibly — not silently.
- Phase 4 sets env vars in external platforms. If the Heroku or Vercel URL is misconfigured, production breaks but development is unaffected.
- Rollback: `git revert` the config files and reset env vars on the hosting platforms. No database migrations, no destructive file removals, no changes to socket event contracts.

---

## File Impact

### Files Confirmed To Exist

- `client/src/socket.js` — `io("/", ...)`, relative path, dev-proxy-dependent
- `client/src/screens/HomeScreen.jsx` — `fetch("/api/games", ...)`
- `client/src/screens/NameEntryScreen.jsx` — `fetch("/api/games/${gameId}")`
- `client/vite.config.js` — Vite dev proxy config
- `server/server.js` — reads `CLIENT_URL` and `PORT` from `process.env` independently
- `server/app.js` — reads `CLIENT_URL` from `process.env` independently
- `server/routes/games.js` — reads `CLIENT_URL` from `process.env` independently
- `.env` — local server env vars

### Files To Create

| File | Purpose |
|---|---|
| `server/config.js` | Shared backend config: reads, validates, normalizes env vars; single source for `allowedOrigins` |
| `client/src/config.js` | Shared frontend config: normalizes `VITE_API_URL`; exports `apiBase` and `socketUrl` |
| `client/.env.local` | Sets `VITE_API_URL=http://localhost:3001` for local dev; not committed |
| `.env.example` | Documents all required env vars for server and client |
| `vercel.json` | *(conditional)* Required only if Vercel project is connected to repo root |
| `Procfile` | *(conditional)* Required only if Heroku does not detect `npm start` automatically |

### Files To Update

| File | Change |
|---|---|
| `server/server.js` | Import `config` from `./config`; remove local `process.env` reads for `CLIENT_URL` |
| `server/app.js` | Import `config` from `./config`; remove local `process.env` read for `CLIENT_URL` |
| `server/routes/games.js` | Import `config` from `./config`; remove local `process.env` read for `CLIENT_URL` |
| `client/src/socket.js` | Replace `io("/", ...)` with `io(socketUrl, ...)` using `socketUrl` from `./config` |
| `client/src/screens/HomeScreen.jsx` | Replace relative fetch URL with `${apiBase}/api/games` |
| `client/src/screens/NameEntryScreen.jsx` | Replace relative fetch URL with `${apiBase}/api/games/${gameId}` |

---

## Acceptance Criteria

- [ ] `client/.env.local` sets `VITE_API_URL=http://localhost:3001`.
- [ ] Running `npm run dev` from repo root: all fetch calls target `http://localhost:3001` explicitly (confirmed in browser Network tab).
- [ ] Running `npm run dev`: socket connects to `http://localhost:3001` explicitly (confirmed in browser Network tab or socket inspector).
- [ ] A full game loop (create → join → lobby → play → results) completes in local dev using the explicit backend URL.
- [ ] `server/config.js` throws a descriptive error on startup if `CLIENT_URL` or `QUESTION_TIME_LIMIT` is missing.
- [ ] `client/src/config.js` logs a `console.error` if `VITE_API_URL` is not set.
- [ ] Base URL normalization: `VITE_API_URL=http://localhost:3001/` (trailing slash) produces the same request URLs as `http://localhost:3001` (no trailing slash).
- [ ] Express CORS and Socket.IO CORS both read from `config.allowedOrigins` — no independent `process.env.CLIENT_URL` reads remain.
- [ ] On Heroku, server starts on `process.env.PORT` and accepts connections from the Vercel origin.
- [ ] On Vercel, client build completes with `VITE_API_URL` set to the Heroku URL; all fetch and socket calls target Heroku.
- [ ] Direct navigation to `/game/:id/join` on Vercel returns the React app (not 404).
- [ ] A full game loop completes in production without runtime errors in the browser console.
- [ ] `.env.example` documents `PORT`, `CLIENT_URL`, `QUESTION_TIME_LIMIT`, and `VITE_API_URL` with comments.
- [ ] In production, `POST /api/games` returns a `gameUrl` using the configured Vercel frontend origin (e.g. `https://<your-vercel-app>.vercel.app/game/:id/join`), not `localhost:5173`.

---

## Open Questions

- Does the Vercel project connect to the repo root or the `client/` subdirectory? This determines whether `vercel.json` is needed.
- Does Heroku detect `npm start` from the root `package.json` automatically? This determines whether `Procfile` is needed.
- Should `CLIENT_URL` on Heroku include `localhost:5173` for cross-environment testing, or stay Vercel-only?
- Does the Heroku deployment need an `engines` field in root `package.json` to pin the Node.js version?

---

## Assumptions

- The Vercel and Heroku apps exist or will be created before Phase 4.
- Heroku is using a paid or eco dyno.
- `client/.env.local` is already in `.gitignore` (Vite's default `.gitignore` excludes `.env.local` files).
- The game's in-memory state is acceptable for production — known limitation, not a bug.
- `VITE_API_URL` values do not include a trailing slash. `config.js` normalizes it regardless, but the convention should be documented in `.env.example`.
