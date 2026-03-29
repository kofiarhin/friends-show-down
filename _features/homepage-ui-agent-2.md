# Agent 2 - Accessibility / Clarity Review

## Read on current homepage

- The interaction order is clear, but the screen depends heavily on button text alone.
- The create flow becomes a temporary mode switch, which can feel abrupt.
- Error messaging exists, but the page offers very little guidance before an error happens.
- The join form would benefit from stronger affordances for pasted invite links.

## Recommended improvement

### Add clearer action framing and helper copy to the homepage

If you want the smallest safe UI upgrade, keep the layout mostly intact but add:

- a short subtitle under each action
- a visible example below the join input, like `Example: ABC123 or full invite link`
- an always-visible selected genre summary for the create path
- a tiny `How it works` row with `Create`, `Share`, `Play`

## Why this helps

- Improves first-time comprehension without adding backend work.
- Helps mobile users understand that pasted links are accepted.
- Reduces the chance of avoidable join errors.
- Gives the homepage a bit more personality and guidance.

## Best low-risk implementation

The easiest version would be:

- keep the current stack
- keep the existing mutation and form handlers
- add a compact info row under the hero
- add helper text to the join field
- add a selected-genre badge once the host opens the genre selector

## Example copy

- Hero subcopy: `Create a room, share the code, and race to answer first.`
- Join helper: `Paste a full invite link or enter a room code.`
- Create helper: `Pick a category and start a room in seconds.`

## Acceptance criteria

- First-time users understand both available paths immediately.
- The join field explains acceptable input before validation fails.
- The page communicates the game loop in under 3 seconds of scanning.
