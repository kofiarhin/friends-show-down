# Agent 3 - Mobile-First Interaction Review

## Read on the current experience

- The app is route-driven, but session navigation is mostly invisible.
- On mobile, the player has to infer where they are from the screen title alone.
- The most important actions are scattered:
  - leave / home is implicit
  - room awareness is buried in page copy
  - chat is visible on some screens but not framed as part of navigation

## Recommended idea

### Add a compact session action bar

Build a small navigation bar for in-session screens that prioritizes frequent actions instead of page links.

Suggested actions:

- `Room`
- `Players`
- `Chat`
- `Leave`

This would behave like a contextual navigation dock rather than a traditional navbar.

## Why this is compelling

- It is highly mobile-friendly.
- It makes the app feel more like a real-time multiplayer product.
- It shortens the path to common secondary actions without forcing users through page transitions.

## Suggested behavior

- `Room`
  - opens room metadata sheet with `gameId`, category, and share link
- `Players`
  - scrolls or jumps to roster area in lobby / results
- `Chat`
  - focuses or opens chat panel
- `Leave`
  - opens confirmation before exiting session

## Why I would not ship this first

- It is more interaction-heavy than the app currently needs.
- It risks introducing complexity before basic route orientation is solved.
- It would likely require coordinated updates to chat, layout, and screen composition.

## Best use of this idea

Ship it after the app has a shared session shell and route guard model.

## Acceptance criteria

- The action bar is easy to use one-handed on mobile.
- It does not obscure answer buttons or timer UI.
- It reuses existing screen sections instead of duplicating content.
- It does not become the primary route source of truth.
