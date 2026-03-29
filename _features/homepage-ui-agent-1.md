# Agent 1 - UX / Conversion Review

## Read on current homepage

- The page is clean, but it feels more like a functional lobby entry than a landing page.
- `Create Game` is the only strong visual CTA at first, while `Join Game` is visually lower priority even though both actions are core.
- Genre selection is hidden behind a click, so the user has to make one decision before seeing the actual options.
- The layout leaves a lot of empty space on desktop and does not communicate the game loop quickly.

## Recommended improvement

### Turn the homepage into a two-card action layout

Replace the current single-column stack with two equally important cards:

1. `Host a game`
   - short helper text
   - visible genre chips
   - one primary CTA
2. `Join a game`
   - invite link / game code input
   - paste-friendly helper copy
   - secondary CTA

## Why this is the strongest improvement

- Reduces decision friction by making both paths obvious immediately.
- Removes the hidden-step feel from the host flow.
- Makes the page feel more intentional on desktop without adding complexity.
- Keeps the implementation small and contained to `client/src/screens/HomeScreen.jsx` plus minor styling tweaks.

## Suggested structure

```text
Friends Showdown
Fast multiplayer trivia for friends

[ Host a game                     ] [ Join a game                    ]
[ pick a category chip grid       ] [ paste link or enter code       ]
[ Create game                     ] [ Join game                      ]
```

## Implementation notes

- Keep the existing state and mutation logic.
- Remove `showGenreSelector` and instead render genre chips inline inside the host card.
- Preselect `mixed` by default so the primary CTA is always usable.
- Use a responsive layout:
  - mobile: stacked cards
  - `md` and up: two columns
- Add a subtle card shell like `rounded-3xl border border-white/10 bg-slate-900/80 p-5 shadow-xl`.

## Acceptance criteria

- Users can see both `Create` and `Join` flows without an extra click.
- Users can pick a genre before pressing `Create Game`.
- Desktop layout uses space better while mobile remains simple.
- No API or socket behavior changes are required.
