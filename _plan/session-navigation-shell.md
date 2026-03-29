# Session Navigation Shell

## Summary

Add a shared in-session header with a compact stage stepper and a central route resolver to all four in-session screens (Join, Lobby, Play, Results). This is a frontend-only change that uses existing Redux state and React Router. It fixes two gaps: players cannot easily tell where they are in the session, and redirect logic is duplicated and inconsistent across individual screens.

## Goal

Every in-session screen shares one navigation shell. Players can always identify the current stage. Invalid or out-of-sequence routes are corrected automatically. No backend changes are required.

## Non-Goals

- Clickable free-form stage navigation (v1 stepper is display-only)
- Bottom action dock / mobile action bar
- Deep-link restore beyond existing join validation
- New backend API endpoints
- New Redux slice or any server state duplication

## Problem

The app has correct routes but no consistent rule set for when those routes should be allowed. Redirect logic is scattered across `NameEntryScreen`, `LobbyScreen`, `GameScreen`, and `ResultsScreen`. A player who lands on `/play` when the game has ended may see a blank or stuck screen instead of being moved to `/results`. Players have no persistent orientation cue while moving through the session.

## Users / Actors

- **Players** — need visual orientation and safe navigation during a session
- **Host** — same needs plus the host badge; should not lose their session on accidental navigation
- **App routing layer** — needs one consistent rule set for valid in-session routes

## Core Requirements

1. A `SessionNavigationShell` component wraps all four in-session screens.
2. The shell renders a compact header with: app home button (left), stage stepper (center), room metadata and leave action (right).
3. A `SessionStageStepper` component shows four stages — Join, Lobby, Play, Results — with active / completed / upcoming visual states. It is display-only in v1.
4. Room metadata shows `gameId`, `genre` (when available), and a host badge when `isHost === true`.
5. A leave / home action is present on every in-session screen with label and confirmation appropriate to the stage.
6. A pure `resolveGameRoute` utility derives the correct route from Redux state and the requested route params.
7. A `useGameRouteGuard` hook calls the resolver and navigates only when the current route is invalid — it never navigates when the route is already correct.
8. All in-session screens integrate the shell and use the route guard, removing local duplicate redirect logic where it is fully superseded.
9. Vitest unit tests cover all route resolution rules including edge cases.

## User Flows

### Player navigates to a valid in-session route

1. Player is at `/game/:id/lobby` with `status === "waiting"` and a valid `nickname`.
2. Shell renders with Lobby step active, room metadata visible, "Back to home" action available.
3. Route guard computes resolved route = `/lobby` — matches current path — no redirect fires.

### Player navigates to an invalid route (e.g. refreshes on `/play` after game ended)

1. Player lands on `/game/:id/play`.
2. Redux state: `status === "ended"`, `lastRoundResults` is populated.
3. Route guard resolves correct route = `/results`.
4. Guard compares resolved path to `location.pathname` — they differ — `navigate()` fires once.
5. Player lands on `/game/:id/results`.

### Player leaves mid-session

1. Player clicks "Leave game" on GameScreen.
2. Confirmation dialog appears.
3. Player confirms.
4. `resetGame()` is dispatched. Player is navigated to `/`.
5. No backend call is required.

### Player leaves from lobby (no confirmation needed)

1. Player clicks "Back to home" on LobbyScreen.
2. No confirmation dialog (no active game in progress).
3. `resetGame()` dispatched. Navigate to `/`.

## Functional Details

### UI / Components

**`SessionNavigationShell.jsx`**
- Renders a full-width header bar inside each session screen.
- Left: icon button — dispatches `resetGame()` and navigates to `/` (with confirmation if `status === "in-progress"`).
- Center: `SessionStageStepper` with `currentStage` prop.
- Right: metadata chips (`gameId`, `genre`, host badge) + leave action button.
- Accepts `title` and `currentStage` props. Reads `gameId`, `genre`, `isHost`, `status` from Redux via selector.
- Renders `children` below the header (existing screen content).

**`SessionStageStepper.jsx`**
- Four stages in order: `join` → `lobby` → `play` → `results`.
- Active stage: indigo accent, bold label.
- Completed stages: muted checkmark or subdued style.
- Upcoming stages: gray / low-emphasis.
- Not a navigation control — no `onClick` handlers in v1.
- Prop: `currentStage: "join" | "lobby" | "play" | "results"`.

### Routing / Navigation

**`resolveGameRoute.js`** (pure utility)

Inputs: `{ pathname, routeGameId, nickname, status, currentQuestion, lastRoundResults }`

Resolution rules (applied in order):

| Condition | Resolved route |
|---|---|
| No `routeGameId` | `null` (do not act) |
| `nickname` is falsy | `/game/:id/join` |
| `status === "waiting"` | `/game/:id/lobby` |
| `status === "in-progress"` and `currentQuestion` exists | `/game/:id/play` |
| `status === "ended"` and `lastRoundResults` exists | `/game/:id/results` |
| `status === "in-progress"` but no `currentQuestion` | keep current route (transient state) |
| `status === "ended"` but no `lastRoundResults` | keep current route (awaiting payload) |

Returns the resolved path string, or `null` if current route is already valid or state is transitional.

**`useGameRouteGuard.js`** (hook)
- Reads `location.pathname` and Redux game state.
- Calls `resolveGameRoute`.
- If result differs from current path, calls `navigate(result, { replace: true })` once.
- Uses `useEffect` with stable dependencies to avoid loops.
- Does not navigate if resolved route is `null`.

### Screen Integration

| Screen | Stage value | Shell label | Leave label | Confirmation |
|---|---|---|---|---|
| `NameEntryScreen` | `join` | Join | Back to home | No |
| `LobbyScreen` | `lobby` | Lobby | Back to home | No |
| `GameScreen` | `play` | Play | Leave game | Yes |
| `ResultsScreen` | `results` | Results | Leave game | No |

Each screen:
- Wraps existing content in `<SessionNavigationShell currentStage="...">`.
- Calls `useGameRouteGuard()` at the top of the component.
- Removes any local redirect logic that is fully covered by the guard.
- Retains any server-validation redirects (e.g. 404 / 409 from `fetchGame` in `NameEntryScreen`).

### Validation / Leave Confirmation

- Confirmation is required only when `status === "in-progress"`.
- Use a simple inline modal or `window.confirm` as a minimal implementation — no new dependency.
- On confirm: dispatch `resetGame()`, then `navigate("/")`.
- On cancel: dismiss and stay.

### Styling

Follow the existing visual language from `HomeScreen` and `ResultsScreen`:

- Shell bar: `bg-slate-900/80 border-b border-white/10`
- Metadata chips: small rounded pills, muted text
- Active stepper step: `text-indigo-400 font-semibold`
- Completed step: `text-slate-500` with optional check icon
- Upcoming step: `text-slate-600`
- Keep the shell compact — max ~56px tall — to preserve gameplay space on `GameScreen`

## States and Edge Cases

| State | Expected behavior |
|---|---|
| `status === "idle"` on a session route | Guard resolves to `/join` (no nickname) |
| Socket delivers `question:start` while guard is active | Socket navigation fires; guard detects route is now valid — no conflict |
| Socket delivers `game:end` while player is on `/play` | Redux updates `status` to `ended` + `lastRoundResults`; guard redirects to `/results` |
| `currentQuestion` is briefly null between questions | Guard holds current route; does not bounce player to `/lobby` |
| Player opens second tab at `/play` without Redux state | Guard fires to `/join` (no nickname in fresh Redux state) |
| Host badge shown to non-host | `isHost` is `false` in Redux — badge is not rendered |
| Leave confirmed on GameScreen | `resetGame()` clears state; no dangling socket listeners because `useSocketEvents` handles `game:closed` separately |

## Technical Notes

- All route resolution logic must live in `resolveGameRoute.js` — the hook is only the side-effect layer.
- Keep `resolveGameRoute` free of React imports so it can be tested with plain Vitest (no render needed).
- Do not add navigation state to Redux. The URL and existing game state are the only sources of truth.
- `useGameRouteGuard` should be called inside each screen component, not in `App.jsx` — this avoids wrapping the entire router and keeps the guard scoped to session routes.
- Do not guard `HomeScreen` or `LeaderboardScreen`.
- The `genre` field is already in Redux (`gameSlice` initial state has `genre: null` — set via `setGame`). Display only when non-null.
- `resetGame()` action already exists in `gameSlice` — use it as-is.

## Acceptance Criteria

- [ ] `SessionNavigationShell` renders on NameEntry, Lobby, GameScreen, and Results screens
- [ ] Stage stepper shows the correct active step on each screen
- [ ] Completed steps are visually distinct from upcoming steps
- [ ] `gameId` is visible in the header on all session screens
- [ ] Host badge only appears when `isHost === true`
- [ ] Clicking the leave/home action on GameScreen shows a confirmation before navigating
- [ ] Clicking leave on NameEntry or Lobby navigates home without confirmation
- [ ] After `resetGame()` + navigate, the player lands on `/` with clean Redux state
- [ ] Navigating to `/game/:id/play` when `status === "ended"` redirects to `/results`
- [ ] Navigating to `/game/:id/lobby` when `status === "in-progress"` redirects to `/play`
- [ ] Navigating to `/game/:id/play` without a `nickname` redirects to `/join`
- [ ] No redirect loop fires when the route is already the resolved route
- [ ] Transient in-progress state (no `currentQuestion` yet) does not cause a redirect
- [ ] All `resolveGameRoute` unit tests pass
- [ ] Existing socket event navigation is not broken
- [ ] Shell header is compact and does not reduce GameScreen usable space significantly

## Open Questions

- None at this stage.

## Assumptions

- `genre` is stored in Redux `gameSlice` under `state.game.genre` and is set during `setGame`.
- The leave action does not need to emit a socket event — the server handles host disconnects via the existing `disconnect` handler.
- `window.confirm` is acceptable for the leave confirmation in v1; a polished modal is a later enhancement.
- New files go under `client/src/components/` and `client/src/utils/` and `client/src/hooks/` per the project structure.

## Implementation Order

1. `client/src/utils/resolveGameRoute.js` + `resolveGameRoute.test.js`
2. `client/src/components/SessionStageStepper.jsx`
3. `client/src/components/SessionNavigationShell.jsx`
4. `client/src/hooks/useGameRouteGuard.js`
5. Integrate shell + guard into `NameEntryScreen`, `LobbyScreen`, `GameScreen`, `ResultsScreen`
6. Remove superseded local redirect logic from integrated screens
7. Run `npm run test:client` — all tests must pass

## New Files

- [client/src/utils/resolveGameRoute.js](../client/src/utils/resolveGameRoute.js)
- [client/src/utils/resolveGameRoute.test.js](../client/src/utils/resolveGameRoute.test.js)
- [client/src/components/SessionNavigationShell.jsx](../client/src/components/SessionNavigationShell.jsx)
- [client/src/components/SessionStageStepper.jsx](../client/src/components/SessionStageStepper.jsx)
- [client/src/hooks/useGameRouteGuard.js](../client/src/hooks/useGameRouteGuard.js)

## Modified Files

- [client/src/screens/NameEntryScreen.jsx](../client/src/screens/NameEntryScreen.jsx)
- [client/src/screens/LobbyScreen.jsx](../client/src/screens/LobbyScreen.jsx)
- [client/src/screens/GameScreen.jsx](../client/src/screens/GameScreen.jsx)
- [client/src/screens/ResultsScreen.jsx](../client/src/screens/ResultsScreen.jsx)
