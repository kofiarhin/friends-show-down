# Add leaderboard with weekly rankings

## Task

Add a leaderboard feature with weekly ranking summaries to the `Friends Showdown` application, including backend ranking aggregation, frontend leaderboard screens, and support for historical weekly leaderboards.

## Goal

Give players a persistent way to compare performance over time by surfacing weekly top players and current weekly standings in addition to the existing session-based leaderboard.

## Project assumptions

- The app currently has real-time game sessions, socket-driven scoring, and a final leaderboard per session.
- There is no existing permanent leaderboard persistence or weekly ranking aggregation.
- The new feature should minimize impact on current socket and game flow logic.
- Data persistence can be in-memory for now, but the feature should be designed so it can later be adapted to a real database.
- Frontend routing and layout should follow the existing Vite + React app structure.

## Functional requirements

- Backend:
  - Persist completed session results in a weekly leaderboard store.
  - Aggregate weekly rankings by player nickname or account ID.
  - Expose REST endpoints for:
    - `GET /api/leaderboard/weekly` — current week standings.
    - `GET /api/leaderboard/weekly/:weekId` — historical week standings.
    - Optionally `GET /api/leaderboard/weekly/latest` for the most recent week.
  - Define a weekly window that resets at a consistent UTC boundary (e.g. Monday 00:00 UTC).
  - Rank players by total score and tie-breakers such as most wins or earliest completed game.
- Frontend:
  - Add a `LeaderboardScreen` or extend an existing leaderboard component.
  - Show current weekly rankings with player position, score, and session count.
  - Provide a selector or tabs to switch between current week and historical weeks.
  - Display a summary for the selected week, including week label and date range.
  - Keep the UI consistent with current leaderboard styling and mobile-friendly layout.
- Experience:
  - The leaderboard should make it easy to see how players compare within the current week.
  - Historical weekly views should make it clear when a week has completed.
  - If no weekly data exists, show a helpful empty state with guidance.

## Non-functional requirements

- Leaderboard queries must be fast and stable.
- Endpoints should be safe for read-only client use.
- Use the existing API conventions and error shapes from the app.
- Keep the implementation isolated to leaderboard-specific backend and frontend files.
- Do not alter existing game socket event contracts unless required.

## Backend considerations

- Add `server/store/leaderboardStore.js` or extend `server/store/gameStore.js` with weekly ranking persistence.
- Store weekly aggregate entries with fields such as:
  - `weekId`, `weekLabel`, `startAt`, `endAt`
  - `playerName` or `playerId`
  - `score`, `wins`, `gamesPlayed`
- Update the leaderboard on game completion, using the final session results emitted by `game:end`.
- Add helper functions to calculate week boundaries and build week IDs.
- Add route handlers in a new `server/routes/leaderboard.js` and mount them under `/api/leaderboard`.
- Add tests covering aggregation, week boundaries, current-week retrieval, and historical lookups.

## Frontend considerations

- Add or update `client/src/screens/LeaderboardScreen.jsx`.
- Add new route(s) in `client/src/App.jsx` for `/leaderboard` and `/leaderboard/:weekId`.
- Add API helpers in `client/src/api/leaderboard.js`.
- Reuse existing leaderboard components such as `FinalLeaderboard` or `MiniLeaderboard` where appropriate.
- Add loading and error handling for leaderboard fetches.
- Show week navigation and a current-week badge.

## Data model changes

- Weekly leaderboard item:
  - `weekId: string`
  - `label: string` (e.g. `Week 14 • Apr 1–7`)
  - `playerId?: string`
  - `playerName: string`
  - `score: number`
  - `wins: number`
  - `gamesPlayed: number`
  - `rank: number`
- Weekly collection:
  - `weekId`
  - `startAt`
  - `endAt`
  - `entries: LeaderboardEntry[]`

## API changes

- `GET /api/leaderboard/weekly`
  - Response: `{ weekId, label, entries: [{ rank, playerName, score, wins, gamesPlayed }] }`
- `GET /api/leaderboard/weekly/:weekId`
  - Response: same shape for historical week.
- Optional `GET /api/leaderboard/weekly/latest`
  - Response: same shape as current week.

## Edge cases

- No completed games in the current week.
- Multiple players with identical scores.
- Retrieving a week ID that does not exist.
- Week boundary transitions in UTC.
- Player names that appear under multiple weekly entries.
- Large weekly dashboards if many players are present.

## Testing requirements

- Backend tests for weekly aggregation after game completion.
- Backend tests for retrieving current-week leaderboard and historical week by ID.
- Backend tests for boundary calculation across week edges.
- Frontend tests for rendering current weekly leaderboard and handling no-data states.
- Frontend tests for navigating between current and historical weeks.

## Acceptance criteria

- The app exposes a current weekly leaderboard endpoint.
- The app exposes historical weekly leaderboard retrieval by weekId.
- The frontend renders a weekly leaderboard screen that matches the app style.
- Weekly ranking data updates after games end.
- Existing game and socket flows remain unchanged.

## Constraints

- Do not refactor existing socket game logic unless necessary.
- Keep new code separate from the real-time session leaderboard flow.
- Avoid adding unnecessary global client state.
- Keep the feature compatible with the existing Express/Vite monorepo architecture.
