# Agent 1 - UX / Product Navigation Review

## Read on the current experience

- The app already has a clear route structure: `/`, `/game/:gameId/join`, `/lobby`, `/play`, and `/results`.
- The user flow is linear, but the UI does not expose that structure back to the player once they enter a session.
- After leaving the homepage, there is no persistent navigation frame that answers basic questions like:
  - where am I?
  - what room am I in?
  - what stage is this game currently in?
  - how do I safely leave?
- Each screen stands alone visually, which makes the app feel more like a set of isolated pages than one connected game session.

## Recommended idea

### Add a persistent session header with a stage stepper

Introduce a shared navigation shell across `NameEntryScreen`, `LobbyScreen`, `GameScreen`, and `ResultsScreen`.

The shell should include:

1. A compact top bar
   - app name or home icon
   - room code / `gameId`
   - current category if known
   - safe leave / home action
2. A session progress stepper
   - `Join`
   - `Lobby`
   - `Play`
   - `Results`
3. A page-level title region
   - reinforces the current screen name
   - keeps the session feeling connected

## Why this is the strongest pure navigation feature

- It solves orientation first, which is the biggest navigation problem in the current product.
- It requires no backend contract change.
- It fits the existing route model instead of forcing a new one.
- It works for both host and player roles.
- It makes future navigation features easier because the app gains a shared session frame.

## Suggested behavior

- The stepper should be informative in v1, not freely navigable.
- The `Home` / `Leave game` action should always be visible.
- During active play, leaving should require confirmation.
- The header should stay lightweight so it does not compete with gameplay.

## Visual structure

```text
[ Home ] Friends Showdown        Room ABC123   Category: Science   [ Leave ]

Join  ──  Lobby  ──  Play  ──  Results
              current step highlighted
```

## Mobile notes

- Stack metadata into two rows.
- Keep the stepper horizontally compact.
- Use chips instead of large pills.
- Avoid a large sticky header that steals vertical space from gameplay.

## Implementation notes

- Add a shared component instead of duplicating header markup across screens.
- Derive the active step from the current route and existing Redux state.
- Reuse existing `gameId`, `genre`, `status`, `nickname`, and `isHost` values.
- Keep screen-specific actions where they already live; the new shell should focus on navigation and orientation.

## Acceptance criteria

- All in-session screens show a consistent navigation shell.
- Players can always identify the current room and current stage.
- There is always a clear path back home.
- The gameplay screen remains focused and uncluttered.
