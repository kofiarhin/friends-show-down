# Session Navigation Shell - Implementation Spec

## Goal

Implement a small, production-safe navigation feature that makes the game session feel connected, improves route correctness, and avoids invalid screen states.

The recommended feature is a **Session Navigation Shell**:

- a shared in-session header
- a compact stage stepper
- a central route resolver / guard

## Why this feature

The current app already has the right route structure, but it has two gaps:

1. **Orientation gap**
   - players cannot always tell where they are in the session lifecycle
2. **Route correctness gap**
   - redirect logic is split across screens instead of being derived consistently from session state

This spec fixes both gaps with the smallest safe frontend change.

## Scope

### In scope

- Shared session header for all in-session screens
- Visual stepper for `Join`, `Lobby`, `Play`, and `Results`
- Single route-resolution utility using existing Redux state
- Lightweight leave / home action with confirmation where needed
- Frontend tests for route resolution behavior

### Out of scope

- Backend changes
- New API endpoints
- Clickable free-form step navigation between stages
- Large layout redesigns
- New Redux slice or duplicated server state

## UX behavior

### Shared header

Render the shell on:

- `client/src/screens/NameEntryScreen.jsx`
- `client/src/screens/LobbyScreen.jsx`
- `client/src/screens/GameScreen.jsx`
- `client/src/screens/ResultsScreen.jsx`

Header content:

- left: app title or home icon button
- center: screen title and stage stepper
- right: room metadata and leave action

Metadata to show when available:

- `gameId`
- `genre`
- host badge if `isHost === true`

## Stepper behavior

Stages:

- `Join`
- `Lobby`
- `Play`
- `Results`

Rules:

- v1 stepper is informative, not a free-navigation control
- current step is highlighted
- completed steps can show subdued `done` styling
- future steps show inactive styling

Rationale:

- session progress is driven by server state
- allowing arbitrary step clicks would create invalid transitions
- route safety matters more than route freedom in this product

## Leave / home action

Behavior:

- on `NameEntryScreen` and `LobbyScreen`, label can be `Back to home`
- on `GameScreen` and `ResultsScreen`, label can be `Leave game`
- if the user is mid-session, confirm before resetting client state and navigating to `/`

The action should:

1. dispatch `resetGame()`
2. navigate to `/`

No backend changes are required for this feature.

## Route resolution model

### Principle

The URL is a request. The current game state decides whether that request is valid.

### Inputs

Use existing Redux fields only:

- `gameId`
- `nickname`
- `status`
- `currentQuestion`
- `lastRoundResults`
- `endReason`

Do not add new persisted navigation state.

### Suggested route state function

Create a pure function that returns the best valid session route.

Suggested signature:

```js
getResolvedGameRoute({
  pathname,
  routeGameId,
  state,
})
```

Alternative if preferred:

```js
resolveGameRoute({
  requestedStage,
  routeGameId,
  nickname,
  status,
  currentQuestion,
  lastRoundResults,
})
```

Keep it pure so it is easy to test with Vitest.

## Resolution rules

### Base rules

- If there is no `routeGameId`, do nothing.
- If `nickname` is missing, the best session route is `/game/:gameId/join`.
- If `status === "waiting"`, the best session route is `/game/:gameId/lobby`.
- If `status === "in-progress"` and `currentQuestion` exists, the best session route is `/game/:gameId/play`.
- If `status === "ended"` and `lastRoundResults` exists, the best session route is `/game/:gameId/results`.

### Conservative fallback rules

- If `status === "in-progress"` but `currentQuestion` is missing, keep the current route until socket state catches up, unless the screen is clearly invalid.
- If `status === "ended"` but `lastRoundResults` is missing, prefer `/game/:gameId/results` only after end payload arrives; otherwise fall back to the best known route.
- Do not override `NameEntryScreen` server validation for `404` or `409` responses.

## Route guard behavior by screen

### Join screen

- allow if player has not joined yet
- if `nickname` exists and `status === "waiting"`, redirect to `/lobby`
- if `nickname` exists and `status === "in-progress"`, redirect to `/play`
- if `nickname` exists and `status === "ended"`, redirect to `/results`

### Lobby screen

- if `nickname` is missing, redirect to `/join`
- if `status === "in-progress"`, redirect to `/play`
- if `status === "ended"`, redirect to `/results`

### Play screen

- if `nickname` is missing, redirect to `/join`
- if `status === "waiting"`, redirect to `/lobby`
- if `status === "ended"`, redirect to `/results`

### Results screen

- if `nickname` is missing, redirect to `/join`
- if `status === "waiting"`, redirect to `/lobby`
- if `status === "in-progress"`, redirect to `/play`

## Component structure

### New components

### `client/src/components/SessionNavigationShell.jsx`

Responsibilities:

- render shared header frame
- render stepper
- render room metadata
- render leave / home action
- render children content area

Props:

- `title`
- `currentStage`
- `children`

Keep the component presentational and derive data from a parent hook or selector.

### `client/src/components/SessionStageStepper.jsx`

Responsibilities:

- render the four stages
- style active / complete / upcoming states

Props:

- `currentStage`

This component should not navigate in v1.

### New utility or hook

### `client/src/utils/resolveGameRoute.js`

Responsibilities:

- pure route resolution logic
- export helper for current stage derivation if useful

Optional companion hook:

### `client/src/hooks/useGameRouteGuard.js`

Responsibilities:

- read current location and Redux state
- compute resolved route
- navigate only when current route is invalid

Keep the navigation side effect in the hook and the decision logic in the utility.

## Screen integration

### `NameEntryScreen.jsx`

- wrap the existing screen content in `SessionNavigationShell`
- set stage to `join`
- keep existing `fetchGame` query logic
- replace ad hoc redirect logic only where it overlaps with the shared route guard

### `LobbyScreen.jsx`

- wrap content in `SessionNavigationShell`
- set stage to `lobby`
- remove the local `nickname` guard if the shared route guard covers it
- keep existing socket actions unchanged

### `GameScreen.jsx`

- wrap content in `SessionNavigationShell`
- set stage to `play`
- keep gameplay layout priority high
- ensure the shell header stays compact on smaller screens

### `ResultsScreen.jsx`

- wrap content in `SessionNavigationShell`
- set stage to `results`
- remove duplicated leave block only if necessary as part of the shell integration

## Styling guidance

- Use existing Tailwind patterns already present in the app.
- Prefer the same visual language as `HomeScreen` and `ResultsScreen`:
  - rounded cards
  - subtle borders
  - dark slate backgrounds
  - indigo highlight for active state
- Keep the shell minimal and compact.
- Avoid a large sticky bar that reduces gameplay space.

Suggested class direction:

- outer shell: `rounded-3xl border border-white/10 bg-slate-900/80`
- metadata chips: small, muted pills
- active step: indigo accent
- inactive step: slate / gray text with low-emphasis divider

## Testing plan

### Required tests

Because this is a frontend behavior change, add or update Vitest coverage.

### `client/src/utils/resolveGameRoute.test.js`

Cover at minimum:

1. missing nickname -> resolves to `/join`
2. waiting state -> resolves to `/lobby`
3. in-progress with question -> resolves to `/play`
4. ended with results -> resolves to `/results`
5. invalid requested route redirects to best valid route
6. already-valid route remains unchanged
7. conservative fallback does not thrash when in-progress lacks question payload temporarily

### Optional component test

`client/src/components/SessionStageStepper.test.jsx`

Cover:

- active stage styling
- completed stage styling
- rendering all four stages

## Implementation order

1. Add `resolveGameRoute` utility and tests
2. Add `SessionStageStepper`
3. Add `SessionNavigationShell`
4. Integrate the shell into session screens
5. Add `useGameRouteGuard` and remove duplicated local guards where safe
6. Run targeted frontend tests

## Risks and mitigations

### Risk: redirect loops

Mitigation:

- compare the resolved route to `location.pathname` before navigating
- keep the resolver pure and heavily unit tested

### Risk: socket event navigation conflicts with route guard

Mitigation:

- route guard should only correct invalid routes
- socket navigation can remain the primary source for live transitions

### Risk: gameplay UI loses space

Mitigation:

- keep the shell compact
- reduce nonessential metadata on mobile

## Definition of done

- All in-session screens share one navigation shell.
- Players can always identify the current session stage.
- Invalid in-session routes are redirected consistently.
- Existing API and socket contracts remain unchanged.
- Frontend tests cover route resolution edge cases.

## Recommended file targets

- `client/src/components/SessionNavigationShell.jsx`
- `client/src/components/SessionStageStepper.jsx`
- `client/src/utils/resolveGameRoute.js`
- `client/src/hooks/useGameRouteGuard.js`
- `client/src/screens/NameEntryScreen.jsx`
- `client/src/screens/LobbyScreen.jsx`
- `client/src/screens/GameScreen.jsx`
- `client/src/screens/ResultsScreen.jsx`
- `client/src/utils/resolveGameRoute.test.js`

## Final recommendation

Implement the **Session Navigation Shell** as a frontend-only change first.

It is the smallest safe feature that improves both navigation clarity and navigation correctness without introducing unnecessary refactors.
