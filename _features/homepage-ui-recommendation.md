# Homepage UI Recommendation

## Final recommendation

The best single improvement to implement is:

### Convert the homepage into a two-card `Host` / `Join` layout with always-visible genre chips

This is the best balance of:

- stronger UX
- low implementation risk
- minimal code changes
- better desktop and mobile presentation

## Why this wins

- It fixes the homepage's biggest UX issue: one of the two main actions is visually secondary, and the host flow hides the actual category choice behind a separate step.
- It improves clarity without changing any API, socket, or state architecture.
- It stays aligned with the current code structure in `client/src/screens/HomeScreen.jsx`.

## What to change

1. Keep the hero title and subtitle.
2. Replace the single stacked action block with two cards.
3. Put genre chips directly inside the `Host a game` card.
4. Default the selected genre to `mixed`.
5. Keep `Join` as a simple code/link form, but add helper text under the input.

## Suggested content

### Card 1: Host a game

- heading: `Host a game`
- helper text: `Pick a category and start a room in seconds.`
- visible genre chips
- CTA: `Create Game`

### Card 2: Join a game

- heading: `Join a game`
- helper text: `Paste an invite link or enter a room code.`
- join input
- CTA: `Join Game`

## Minimal implementation path

- Update `client/src/screens/HomeScreen.jsx`
  - remove the mode-switch rendering for `showGenreSelector`
  - render the genre options inline
  - set `selectedGenre` default to `mixed`
  - wrap host and join sections in responsive cards
- Optional small style tweaks in `client/src/App.css` only if you want extra background polish

## Suggested layout classes

```jsx
<div className="w-full max-w-4xl grid gap-4 md:grid-cols-2">
```

```jsx
className="rounded-3xl border border-white/10 bg-slate-900/80 p-5 shadow-xl"
```

## Definition of done

- Both actions are visible immediately on load.
- Genre selection is visible without opening a separate step.
- Mobile layout stacks naturally.
- The page feels more polished without adding new abstractions.

## Nice-to-have after that

- Add a tiny `Create`, `Share`, `Play` explainer row under the hero.
- Add icons to the `Host` and `Join` card headings.
