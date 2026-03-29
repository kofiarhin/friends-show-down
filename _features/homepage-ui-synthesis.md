# Homepage UI Synthesis

## Best recommendation

The strongest homepage improvement is a **two-card `Host a game` / `Join a game` layout** with **always-visible genre chips**, supported by **clear helper copy** and **light visual polish**.

This keeps the fix small, improves clarity immediately, and gives the page a more intentional landing-page feel without changing any backend, socket, or state architecture.

## Why this is the best synthesis

Across all `homepage-ui*.md` notes, the same themes show up:

- the current homepage hides part of the host flow behind an extra click
- `Create Game` visually dominates while `Join Game` feels secondary
- first-time users are not given enough guidance before they interact
- the page is functional but visually sparse for a game landing screen

The best solution is to address all four at once with one focused redesign:

1. **Make both primary actions visible immediately**
2. **Expose genre selection inline**
3. **Add lightweight explanatory copy**
4. **Use subtle polish to improve hierarchy, not distract from actions**

## Recommended homepage structure

### Hero

- Keep the `Friends Showdown` title
- Update the subtitle to something clearer, such as:
  - `Create a room, share the code, and race to answer first.`
- Add a compact `How it works` row:
  - `Create`
  - `Share`
  - `Play`

### Main action area

Use two responsive cards:

#### Card 1: `Host a game`

- helper text: `Pick a category and start a room in seconds.`
- render genre chips inline instead of hiding them behind `Create Game`
- preselect `mixed` by default
- keep one clear primary CTA: `Create Game`

#### Card 2: `Join a game`

- helper text: `Paste an invite link or enter a room code.`
- keep the existing input and submit behavior
- add example helper text below the input:
  - `Example: ABC123 or a full invite link`
- keep one CTA: `Join Game`

## Visual direction

Use subtle polish only:

- wrap the content in a centered panel or card shell
- add soft indigo/pink background glow at low opacity
- keep the controls as the most visually prominent elements
- maintain strong contrast and simple mobile spacing

Good baseline classes:

```jsx
<div className="w-full max-w-4xl grid gap-4 md:grid-cols-2">
```

```jsx
className="rounded-3xl border border-white/10 bg-slate-900/80 p-5 shadow-xl"
```

## Why this beats the alternatives

- It improves UX more than copy-only changes
- It stays lower risk than a heavily decorative redesign
- It solves both comprehension and layout problems together
- It fits the existing `HomeScreen` implementation with minimal refactor

## Minimal implementation plan

Update `client/src/screens/HomeScreen.jsx`:

- remove the temporary `showGenreSelector` mode-switch UI
- render genre choices inline in the host card
- initialize `selectedGenre` to `mixed`
- keep existing `createGame` mutation and `handleJoin` logic
- add helper copy for both cards
- add a small `How it works` row under the hero

Optionally update `client/src/App.css` only for light hero/background polish.

## Definition of done

- users can see `Host` and `Join` immediately on page load
- users can choose a genre without an extra step
- the join field explains accepted input before validation errors happen
- desktop space is used better while mobile stays clean
- the page feels more polished without adding unnecessary abstractions

## Final recommendation in one line

Redesign the homepage as a two-card `Host` / `Join` landing screen with inline genre chips, clearer helper copy, and subtle hero polish.
