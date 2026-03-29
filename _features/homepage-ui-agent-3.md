# Agent 3 - Visual Design / Delight Review

## Read on current homepage

- The page is functional but visually sparse.
- The strong indigo title sets a good tone, but there is no supporting visual treatment around it.
- The create and join blocks do not feel like part of a branded landing experience yet.
- A little visual hierarchy would make the page feel more polished without changing behavior.

## Recommended improvement

### Add a hero panel with soft glow, quick stats, and stronger section separation

This version focuses on polish rather than layout changes:

- wrap the content in a centered hero panel
- add a subtle radial glow or gradient backdrop behind the title
- show three tiny stat pills such as `2+ players`, `real-time`, `fast rounds`
- visually separate `Create Game` and `Join Game` with card sections

## Why it works

- Makes the homepage feel more game-like and intentional.
- Gives users confidence about what the product is before they act.
- Uses purely client-side styling changes with minimal logic impact.

## Tailwind-friendly approach

- Outer wrapper: `relative overflow-hidden`
- Background accents: blurred indigo / pink circles with low opacity
- Panel: `mx-auto max-w-4xl rounded-[32px] border border-white/10 bg-slate-900/70 p-6 shadow-2xl`
- Stat pills: compact badges below the subtitle

## Caution

- Keep this subtle.
- Avoid overdesign that competes with the form controls.
- Do not let decorative layers reduce contrast or readability.

## Acceptance criteria

- The homepage feels fuller and more premium.
- The primary actions remain the most visually obvious elements.
- Mobile readability stays strong and uncluttered.
