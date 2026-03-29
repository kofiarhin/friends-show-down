# Homepage UI Redesign

## Summary

The current homepage is clean and functional, but it behaves more like a utility entry screen than a strong landing page. The host flow hides genre selection behind an extra click, `Create Game` visually dominates over `Join Game`, and first-time users get very little guidance before interacting.

This spec proposes a small, production-safe homepage redesign that keeps the current create/join logic intact while improving clarity, visual hierarchy, and perceived polish.

## Goal

Turn the homepage into a clearer landing experience by making both primary actions visible immediately, exposing genre selection inline for hosts, and adding lightweight copy and polish that help users understand how to start playing quickly.

## Non-Goals

- Change any backend routes, payloads, or response shapes.
- Change socket events, join flow semantics, or host authorization behavior.
- Move API logic out of the existing `HomeScreen` flow beyond what already exists.
- Introduce Redux state for new UI behavior that can stay local to the component.
- Add animation libraries or new UI dependencies.
- Perform a broader site-wide visual redesign.

## Problem

The current `HomeScreen` has three main UX weaknesses:

- **Hidden host choice**: users click `Create Game` before they can see or choose a genre.
- **Uneven action hierarchy**: `Create Game` feels primary while `Join Game` reads like a secondary afterthought, even though both are core journeys.
- **Low onboarding clarity**: the page does not quickly explain that users can create a room, share a code, or paste a full invite link.

There is also a technical styling constraint worth preserving:

- `client/src/main.jsx` imports `client/src/index.css`, not `client/src/App.css`, so any custom homepage styling should either stay in Tailwind utility classes or go into `index.css` if truly necessary.

## Users / Actors

- **Host**: wants to choose a genre and create a room quickly.
- **Joining player**: wants to paste a room link or type a room code without guessing the expected format.
- **First-time user**: needs to understand the game loop within a few seconds of scanning the homepage.
- **Returning user**: benefits from a faster path with fewer clicks.

## Core Requirements

1. Show both main actions, `Host a game` and `Join a game`, immediately on initial load.
2. Render genre selection inline inside the host area instead of behind a temporary mode-switch UI.
3. Default the selected genre to `mixed` so `Create Game` is always actionable.
4. Keep the existing `createGame` mutation behavior and success navigation intact.
5. Keep the existing join parsing logic intact unless a targeted correctness fix is needed.
6. Add helper copy that explains each action before validation or submission.
7. Add a compact `How it works` row under the hero to explain the game loop at a glance.
8. Use responsive layout so mobile remains stacked and desktop uses available width more effectively.
9. Keep the implementation focused primarily in `client/src/screens/HomeScreen.jsx`.
10. Avoid introducing unnecessary abstractions, new global state, or unrelated refactors.

## Proposed UX

### Hero section

Keep the title but make the support copy more instructive.

- Title: `Friends Showdown`
- Subtitle: `Create a room, share the code, and race to answer first.`

Under the subtitle, add a compact `How it works` row with three simple steps:

- `Create`
- `Share`
- `Play`

This should be visually lightweight and not compete with the CTAs.

### Main action layout

Replace the single-column action stack with two cards:

1. **Host a game**
2. **Join a game**

Layout behavior:

- **Mobile**: stacked cards
- **`md` and up**: two-column grid

### Host card

The host card should include:

- heading: `Host a game`
- helper text: `Pick a category and start a room in seconds.`
- visible genre chips/buttons
- primary CTA: `Create Game`

Behavior:

- initialize `selectedGenre` to `mixed`
- remove `showGenreSelector`
- keep using local state for selected genre
- keep the existing mutation pending/error handling

### Join card

The join card should include:

- heading: `Join a game`
- helper text: `Paste an invite link or enter a room code.`
- existing input field
- example text under the input: `Example: ABC123 or a full invite link`
- CTA: `Join Game`

Behavior:

- preserve the current join parsing and navigation flow
- preserve existing validation messages
- keep this path lightweight and paste-friendly

## UI Structure

Suggested high-level structure in `HomeScreen`:

```text
Page shell
  Hero
    Title
    Subtitle
    How it works row
  Action grid
    Host card
      Card title
      Helper text
      Genre chips
      Mutation error
      Create button
    Join card
      Card title
      Helper text
      Join input
      Example helper text
      Validation error
      Join button
```

## Visual Direction

The homepage should feel more intentional and premium, but still minimal.

### Card styling

Use a subtle card shell such as:

- `rounded-3xl`
- `border border-white/10`
- `bg-slate-900/80`
- `shadow-xl`
- `p-5` or `p-6`

### Layout classes

Suggested main action wrapper:

```jsx
<div className="w-full max-w-4xl grid gap-4 md:grid-cols-2">
```

### Optional polish

If desired, add light hero/background treatment:

- subtle blurred indigo/pink glow shapes
- a centered content panel
- small pill-style step badges for `Create`, `Share`, `Play`

This polish must stay subtle and must not reduce contrast or distract from the forms.

## Content Recommendations

### Hero

- Title: `Friends Showdown`
- Subtitle: `Create a room, share the code, and race to answer first.`

### Host card

- Title: `Host a game`
- Helper: `Pick a category and start a room in seconds.`

### Join card

- Title: `Join a game`
- Helper: `Paste an invite link or enter a room code.`
- Example: `Example: ABC123 or a full invite link`

## Technical Notes

- Keep API logic where it already lives for this screen; this change is a UI restructuring, not an architecture rewrite.
- Remove the `showGenreSelector` branch and simplify the render path so the page is easier to scan and maintain.
- Keep `selectedGenre` in local component state and set the initial value to `mixed`.
- Preserve `mutation.reset()` where needed so stale error state does not linger unnecessarily.
- Prefer Tailwind utilities first. If custom CSS is needed for glow/background effects, put it in `client/src/index.css`, not `client/src/App.css`.
- Do not introduce reusable abstraction layers unless the final JSX becomes clearly unmanageable.
- Keep button text, error messages, and input behavior consistent with existing app tone.

## File Scope

### Primary file

- `client/src/screens/HomeScreen.jsx`

### Optional styling file

- `client/src/index.css`

### Possible test file to add

- `client/src/screens/HomeScreen.test.jsx`

## Testing Plan

Frontend tests use Vitest, so this implementation should add focused coverage for the homepage behavior.

### Add tests for

1. both `Host a game` and `Join a game` sections render on initial load
2. default genre selection is present on first render
3. clicking a different genre updates the selected state visually/semantically
4. clicking `Create Game` triggers the existing mutation path with the selected genre
5. the join form accepts a room code and navigates correctly
6. the join form accepts a full invite link and extracts the game id correctly
7. invalid join input shows the existing validation message

### Do not test

- decorative glow visuals
- exact Tailwind class strings beyond the minimum needed for stable assertions

## Edge Cases

- Very long localized or future helper copy should not break card layout.
- Genre chips should wrap cleanly on small screens.
- Mutation pending state should still disable or visually de-emphasize the create CTA.
- Join helper text should remain visible without pushing errors off-screen on mobile.
- Empty or invalid join input should remain a client-side validation flow, not a navigation attempt.

## Acceptance Criteria

- [ ] Both main paths are visible immediately when the homepage loads.
- [ ] Genre selection is visible without clicking into a separate create mode.
- [ ] `mixed` is selected by default for the host flow.
- [ ] Existing create and join behavior still works without API or socket changes.
- [ ] The join card clearly communicates that users can paste a full invite link or enter a code.
- [ ] Desktop layout uses space better than the current single-column stack.
- [ ] Mobile layout remains clean, readable, and easy to tap.
- [ ] No new global state or unnecessary abstractions are introduced.
- [ ] Homepage UI tests cover the main interaction paths.

## Implementation Steps

1. Refactor `HomeScreen` layout from a single action stack to a hero plus two-card grid.
2. Remove `showGenreSelector` UI branching.
3. Default `selectedGenre` to `mixed`.
4. Move genre options into the host card as always-visible chips.
5. Add helper copy to both cards and a `How it works` row beneath the hero.
6. Preserve existing create/join handlers and error behavior.
7. Add tests for homepage render and interaction flows.
8. Add optional `index.css` polish only if Tailwind utilities are insufficient.

## Risks

- Over-polishing the hero could reduce clarity if visual layers compete with the forms.
- Moving too much styling into custom CSS could make the change harder to maintain than a mostly Tailwind solution.
- Over-refactoring `HomeScreen` could introduce regressions in create/join behavior for a problem that is mostly presentational.

## Open Questions

- Should the `How it works` row use plain text pills, icons, or both?
- Should the host and join cards be visually equal, or should the host card still have slightly stronger emphasis?
- Is subtle background glow enough, or is a centered hero panel preferred for v1?
- Should `mixed` remain the default forever, or should the app remember the last chosen genre in a future enhancement?

## Assumptions

- The best version of this request is a focused homepage redesign, not a broader navigation or branding overhaul.
- Existing create/join logic is already correct enough for this pass and should be preserved.
- The implementation should stay minimal, Tailwind-first, and compatible with the current Vite/React structure.
