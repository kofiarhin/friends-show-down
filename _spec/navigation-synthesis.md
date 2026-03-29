# Navigation Synthesis

## Summary of the three ideas

### Agent 1

Recommends a persistent session header with a progress stepper to improve orientation and make navigation visible.

### Agent 2

Recommends a central route resolver so stale, invalid, or out-of-sequence URLs always redirect to the correct screen.

### Agent 3

Recommends a mobile-first session action bar focused on room, players, chat, and leave actions.

## Evaluation

### Best for immediate user value

Agent 1 wins on visibility. Players immediately understand where they are and what stage the game is in.

### Best for correctness and resilience

Agent 2 wins on architecture. It addresses the root navigation problem: the app has valid routes, but it does not have one consistent rule set for when those routes should be allowed.

### Best for future polish

Agent 3 wins on interaction quality, especially on mobile, but it is a second-phase enhancement rather than the right first move.

## Final recommendation

### Implement a shared session navigation shell backed by a central route resolver

This combines the best parts of Agent 1 and Agent 2:

1. A visible session header and stepper for orientation
2. A single route-resolution rule set for correctness

This is the strongest recommendation because it improves both perceived navigation and actual navigation behavior.

## Why this is the right v1

- It stays inside the current React Router structure.
- It does not require backend changes.
- It uses existing Redux state instead of adding a new navigation store.
- It reduces duplicated redirect logic already appearing in individual screens.
- It creates a reusable shell for future enhancements like Agent 3's mobile action dock.

## Recommended v1 boundaries

### Include

- shared session header
- compact stage stepper
- room metadata display
- safe leave / home action
- central route guard logic
- frontend tests for route resolution

### Defer

- fully clickable stage navigation
- bottom action dock
- deep-link restore beyond existing join validation
- new backend APIs

## Product recommendation

Call the feature:

### Session Navigation Shell

That name describes both the visible UI and the route-safety behavior behind it.
