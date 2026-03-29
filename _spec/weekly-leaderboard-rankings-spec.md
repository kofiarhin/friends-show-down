# Weekly Leaderboard Rankings - Implementation Spec

## Goal

Add a weekly leaderboard feature that surfaces current-week standings and historical weekly rankings, while preserving the existing real-time game session flow.

Players should be able to compare performance across weeks and inspect completed weekly leaderboards, with a safe backend aggregation approach and a frontend leaderboard screen that supports empty states.

## Why

The app currently shows only session-level final results. Weekly leaderboard rankings provide persistence across games and a stronger sense of long-term competition, without requiring accounts or permanent storage beyond in-memory weekly aggregates.

## Scope

### In scope

- Backend weekly leaderboard aggregation for completed games
- In-memory weekly leaderboard persistence compatible with current Express server design
- REST endpoints:
  - `GET /api/leaderboard/weekly` for current week standings
  - `GET /api/leaderboard/weekly/:weekId` for historical week standings
- Frontend leaderboard screen with current-week and historical-week navigation
- Empty state messaging for no weekly data
- Tests covering backend aggregation, current/historical retrieval, and frontend rendering

### Out of scope

- User authentication / account-based leaderboards
- Persistent database storage beyond in-memory server state
- Real-time socket-driven leaderboard updates during active games
- Large UI redesigns unrelated to leaderboard display

## API contract

### `GET /api/leaderboard/weekly`

Response shape:

```json
{
  "weekId": "2026-W14",
  "label": "Week 14 • Apr 1–7",
  "startAt": "2026-04-01T00:00:00.000Z",
  "endAt": "2026-04-07T23:59:59.999Z",
  "entries": [
    {
      "rank": 1,
      "playerName": "Taylor",
      "score": 12,
      "wins": 3,
      "gamesPlayed": 5
    }
  ]
}
```

### `GET /api/leaderboard/weekly/:weekId`

Response shape: identical to current-week response.

### Error cases

- `404` if `weekId` does not exist
- `400` for invalid `weekId` format

## Data model

### Weekly leaderboard window

- Use a consistent UTC boundary for week calculations.
- A week begins Monday 00:00 UTC and ends Sunday 23:59:59.999 UTC.
- The `weekId` is a stable identifier such as `YYYY-Www`.

### Aggregated week object

- `weekId: string`
- `label: string` (for display, e.g. `Week 14 • Apr 1–7`)
- `startAt: string`
- `endAt: string`
- `entries: WeeklyLeaderboardEntry[]`

### Entry fields

- `rank: number`
- `playerName: string`
- `score: number`
- `wins: number`
- `gamesPlayed: number`

## Backend implementation

### Storage

- Add a new server-side store module, such as `server/store/leaderboardStore.js`, or extend `server/store/gameStore.js` with weekly leaderboard persistence.
- The store should keep a map of `weekId -> weekAggregate` in memory.
- Provide helpers to compute current week boundaries and the `weekId` from a timestamp.

### Aggregation

- When a game ends, update the current week's aggregate:
  - add the completed session's final player scores
  - increment `gamesPlayed` for each player
  - increment `wins` for first-place or winning players if relevant
- Aggregate by player name to keep the feature compatible with the current anonymous nickname flow.
- If a player appears in multiple sessions within the same week, accumulate `score`, `wins`, and `gamesPlayed` into one weekly entry.

### Ranking rules

- Sort entries by total `score` descending.
- Tie-breaker order:
  1. higher `wins`
  2. higher `gamesPlayed`
  3. stable order by `playerName`
- Assign `rank` values sequentially after sorting.

### Routes

- Create `server/routes/leaderboard.js` and mount it in `server/app.js` under `/api/leaderboard`.
- `GET /weekly` returns the current week aggregate.
- `GET /weekly/:weekId` returns a historical week aggregate.

### Validation

- Validate `weekId` path params with a helper.
- Return `404` when a week is missing.
- Do not expose internal store details beyond the public response shape.

## Frontend implementation

### Screen

- Add `client/src/screens/LeaderboardScreen.jsx`.
- The screen should fetch leaderboard data from `/api/leaderboard/weekly` by default.
- Support viewing historical weeks by optionally using route param `/leaderboard/:weekId`.
- Display:
  - selected week label and date range
  - current position and score listing
  - `gamesPlayed` and `wins` counts per entry

### Navigation

- Add new route(s) in `client/src/App.jsx`:
  - `/leaderboard` for current week
  - `/leaderboard/:weekId` for historical weeks
- Add a navigation link to the leaderboard screen from a sensible location such as the home screen or lobby if no existing menu is available.

### List rendering

- Reuse `FinalLeaderboard` or `MiniLeaderboard` for player rows when practical.
- Keep the row presentation compact and mobile-friendly.
- Highlight the top-ranked player.

### Empty states

- If no entries exist for the current week, render:
  - `No leaderboard data yet for this week.`
  - `Play a game to start the weekly rankings.`
- If historical week data exists but has no entries, render a similar empty state and show the requested week label.
- If the requested `weekId` is invalid or missing, show a friendly error message and a link back to current week.

### API helpers

- Add `client/src/api/leaderboard.js` with fetch helpers for current and historical week endpoints.
- Use the existing API base configuration in `client/src/config.js`.

### UI behavior

- Show a loading indicator while fetching leaderboard data.
- Show an error message for fetch failures.
- Allow the user to switch between current week and historical weeks if the route is available.
- Keep styling aligned with current app palette and typography.

## Testing

### Backend tests

- `server/routes/leaderboard.test.js`
  - current week endpoint returns aggregated weekly standings
  - historical week endpoint returns expected week data
  - invalid `weekId` returns `404`
- `server/store/leaderboardStore.test.js`
  - week boundary helpers compute the correct UTC week window
  - aggregation accumulates scores across multiple sessions in the same week
  - tie-breakers are stable and deterministic

### Frontend tests

- `client/src/screens/LeaderboardScreen.test.jsx`
  - renders current weekly leaderboard entries correctly
  - renders an empty state when no weekly data exists
  - handles a historical week route and displays the selected week label
  - shows loading state when fetching data
  - shows error state on failed fetch

### Acceptance criteria

- Current week leaderboard data is available at `/api/leaderboard/weekly`.
- Historical week leaderboard data is available at `/api/leaderboard/weekly/:weekId`.
- The leaderboard screen renders current week standings with ranks, scores, wins, and games played.
- Empty states appear when no leaderboard data exists.
- Backend aggregation updates weekly entries after completed games.
- Existing session and socket flows remain unchanged.
