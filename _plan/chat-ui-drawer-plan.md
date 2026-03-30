# Chat UI Drawer Implementation Plan

## Goal

Implement a minimal, in-game chat drawer that keeps the play screen clean while preserving easy access to chat.

## Why

The current chat UI takes too much room during active gameplay and distracts from answer selection. This plan moves chat into a compact, expandable drawer so gameplay regains screen real estate and chat remains discoverable.

## Scope

### In scope

- A new chat drawer wrapper component
- Minimized chat control on `GameScreen`
- Expandable chat drawer overlay/panel
- Unread count indicator and lightweight preview
- Disabled or read-only input state during active questions
- Responsive behavior for desktop and mobile

### Out of scope

- backend/socket changes
- new chat message formats
- full chat redesign beyond the play screen
- account/profile or chat moderation features

## Implementation steps

### 1. Add `ChatDrawer` component

Create `client/src/components/ChatDrawer.jsx`.

Responsibilities:
- render minimized control and expanded drawer
- show unread badge and preview when minimized
- toggle expanded state
- forward existing chat props to `ChatPanel`

### 2. Make `ChatPanel` flexible

Update `client/src/components/ChatPanel.jsx` if needed so it can render in:
- compact mode (preview-only, no input)
- full mode (message list + input)

Prefer minimal code changes: keep existing message rendering and only add UI mode props.

### 3. Update `GameScreen` layout

Modify `client/src/screens/GameScreen.jsx`:
- remove or reduce the fixed chat panel container
- add `ChatDrawer` as a game overlay or right-side control
- ensure answer buttons and question content retain priority space

### 4. Support minimized and expanded drawer states

Drawer states:
- `minimized`
  - small floating bubble or slim sidebar
  - shows unread count
  - optionally shows last message preview
- `expanded`
  - full chat drawer/sidebar
  - header with close button
  - scrollable messages
  - sticky input footer when enabled

### 5. Handle input availability during active questions

During `game.status === "in-progress"` and `game.roundPhase === "question_live"`:
- allow chat reading in the expanded drawer
- disable or hide the input area with a status placeholder
- make the disabled state visually soft, not harsh

### 6. Add responsive behavior

Desktop:
- use a right-side drawer anchored to the game area
- keep the minimized control outside answer buttons

Mobile:
- use a floating button or bottom drawer
- avoid covering essential game controls

### 7. Add tests

Add component tests for:
- `ChatDrawer` toggles minimized/expanded state
- minimized control renders unread count
- expanded drawer shows messages
- chat input is disabled during active questions

Update `GameScreen` tests if needed to verify the new layout includes `ChatDrawer`.

## Success criteria

- Chat is accessible from a compact, non-intrusive control during gameplay
- expanded drawer opens on demand and shows full chat history
- unread messages are clearly indicated when minimized
- chat input is disabled while questions are live
- game content regains room previously occupied by the fixed chat panel

## Notes

This is a presentation-only change. Reuse existing chat socket logic and message state. Keep the new UI small and incremental to avoid large refactors.
