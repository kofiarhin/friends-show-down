# Agent 2 - Route Integrity / Recovery Review

## Read on the current experience

- The app uses route-based screens correctly, but route safety is handled in a scattered way.
- `LobbyScreen` and `GameScreen` redirect to `/join` if `nickname` is missing.
- `NameEntryScreen` loads the game from the server and handles `404` and `409` states.
- `useSocketEvents` performs navigation when socket events arrive.
- There is no single source of truth that decides whether the current URL is valid for the current client state.

That means the URL currently behaves partly like a source of truth and partly like a request. For a real-time game, that is fragile.

## Recommended idea

### Add a central route resolver and guard layer

Treat the URL as a navigation request, not as authority.

Create a small route-resolution utility that decides the correct destination from existing client state:

- no nickname -> `join`
- waiting game -> `lobby`
- active game -> `play`
- finished game -> `results`

Then apply that resolver consistently from session screens.

## Why this is the strongest correctness-focused navigation feature

- It removes duplicated redirect rules from individual screens.
- It makes reload and reconnect behavior more predictable.
- It prevents users from sitting on stale or impossible routes.
- It aligns with the real-time model: the server and socket state decide the valid stage, not the typed URL.

## Example problems it solves

1. User bookmarks `/game/ABC123/play` and returns later.
   - If the game has not started, the client should send them to `/lobby`.
2. User refreshes on `/game/ABC123/results` before results state is restored.
   - The client should move to the best valid route instead of showing partial UI.
3. Socket moves the game from lobby to play while the user is on a stale route.
   - The route guard and socket navigation should agree on the destination.

## Suggested rule set

### Public route

- `/` is always valid.

### Session routes

- `/game/:gameId/join`
  - valid when the player has not joined yet and the game is joinable
  - redirect to `/lobby` if the player already joined and the game is waiting
- `/game/:gameId/lobby`
  - valid when `nickname` exists and `status` is `waiting`
  - redirect to `/join` if `nickname` is missing
  - redirect to `/play` if `status` is `in-progress`
  - redirect to `/results` if `status` is `ended`
- `/game/:gameId/play`
  - valid when `nickname` exists and gameplay is active
  - redirect to `/join` if `nickname` is missing
  - redirect to `/lobby` if the round has not started
  - redirect to `/results` if the game already ended
- `/game/:gameId/results`
  - valid when results exist for the current game session
  - otherwise redirect to the best valid route

## Implementation notes

- Keep the logic pure and testable in a utility function.
- Do not fetch extra data just for navigation.
- Use existing Redux state only.
- Let `NameEntryScreen` keep its server validation because joinability is a server concern.

## Acceptance criteria

- Invalid in-session URLs redirect deterministically.
- Route rules live in one place.
- Reload and reconnect produce the same destination logic as live socket transitions.
- No extra server state is duplicated in Redux.
